const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const bucketName = 'yrc-application-documents';
const maximumImageBytes = 4 * 1024 * 1024;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maximumImageBytes, files: 1, fields: 8 },
  fileFilter(_request, file, callback) {
    if (!imageTypes.has(file.mimetype)) {
      callback(new Error('Upload a JPG, PNG, or WebP image.'));
      return;
    }
    callback(null, true);
  }
});

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function isValidImageSignature(file) {
  const bytes = file.buffer;
  if (file.mimetype === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (file.mimetype === 'image/webp') {
    return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

router.get('/', (_request, response) => {
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  response.status(configured ? 200 : 503).json({ status: configured ? 'configured' : 'supabase_not_configured' });
});

router.post('/', (request, response, next) => {
  upload.fields([
    { name: 'class12Marksheet', maxCount: 1 },
    { name: 'cgpaPhoto', maxCount: 1 }
  ])(request, response, (error) => {
    if (error) {
      const status = error instanceof multer.MulterError
        ? (error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
        : 400;
      response.status(status).json({ error: error.message });
      return;
    }
    next();
  });
}, async (request, response) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    response.status(503).json({ error: 'Supabase is not configured on the server. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  const fullName = typeof request.body.fullName === 'string' ? request.body.fullName.trim() : '';
  const contactNumber = typeof request.body.contactNumber === 'string' ? request.body.contactNumber.trim() : '';
  const department = typeof request.body.department === 'string' ? request.body.department.trim() : '';
  const rawYear = typeof request.body.year === 'string' ? request.body.year.trim() : '';
  const year = rawYear === 'other' ? 'other' : Number(rawYear);
  const files = request.files || {};
  const class12Marksheet = files.class12Marksheet?.[0];
  const cgpaPhoto = files.cgpaPhoto?.[0];

  if (!fullName || fullName.length > 120) {
    response.status(400).json({ error: 'Enter a name up to 120 characters long.' });
    return;
  }
  if (!/^[0-9+() -]{7,20}$/.test(contactNumber)) {
    response.status(400).json({ error: 'Enter a valid contact number.' });
    return;
  }
  if (!department || department.length > 120) {
    response.status(400).json({ error: 'Enter a department up to 120 characters long.' });
    return;
  }
  if (!(year === 'other' || [1, 2, 3, 4].includes(year))) {
    response.status(400).json({ error: 'Select a valid study year.' });
    return;
  }

  let academicDetails;
  let academicFile;
  let academicFileField;

  if (year === 1) {
    const class12Marks = typeof request.body.class12Marks === 'string' ? request.body.class12Marks.trim() : '';
    if (!class12Marks || class12Marks.length > 80 || !class12Marksheet || cgpaPhoto) {
      response.status(400).json({ error: 'First-year applicants must provide Class 12 marks and one marksheet image.' });
      return;
    }
    academicDetails = { class12Marks };
    academicFile = class12Marksheet;
    academicFileField = 'class12Marksheet';
  } else {
    const cgpa = Number(request.body.cgpa);
    if (!Number.isFinite(cgpa) || cgpa < 0 || !cgpaPhoto || class12Marksheet) {
      response.status(400).json({ error: 'Applicants beyond first year must provide a valid CGPA and one CGPA proof image.' });
      return;
    }
    academicDetails = { cgpa };
    academicFile = cgpaPhoto;
    academicFileField = 'cgpaPhoto';
  }

  if (!isValidImageSignature(academicFile)) {
    response.status(400).json({ error: 'The uploaded file does not match a supported JPG, PNG, or WebP image.' });
    return;
  }

  const documentPath = `${randomUUID()}/${academicFileField}${path.extname(academicFile.originalname).toLowerCase()}`;
  try {
    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .upload(documentPath, academicFile.buffer, {
        contentType: academicFile.mimetype,
        upsert: false
      });

    if (storageError) throw storageError;

    const { data, error: insertError } = await supabase
      .from('yrc_applications')
      .insert({
        full_name: fullName,
        contact_number: contactNumber,
        department,
        year,
        academic_details: academicDetails,
        document_path: documentPath,
        document_original_name: path.basename(academicFile.originalname).slice(0, 200),
        document_content_type: academicFile.mimetype,
        document_size: academicFile.size,
        status: 'pending'
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    response.status(201).json({
      message: 'Your Youth Red Cross application was saved.',
      applicationId: data.id
    });
  } catch (error) {
    await supabase.storage.from(bucketName).remove([documentPath]).catch(() => {});
    console.error('Application could not be saved:', error.message);
    response.status(500).json({ error: 'The application could not be saved. Please try again later.' });
  }
});

module.exports = router;
