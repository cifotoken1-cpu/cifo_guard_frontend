const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { VisitorRegistration, QRCode } = require('../models');
const { Op } = require('sequelize');

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/visitor-photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'visitor-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware to validate geolocation
const validateGeolocation = async (req, res, next) => {
  const { qr_code_id, location_lat, location_lng } = req.body;
  
  if (!qr_code_id || !location_lat || !location_lng) {
    return res.status(400).json({
      success: false,
      message: 'QR code ID and location coordinates are required'
    });
  }

  try {
    const qrCode = await QRCode.findByPk(qr_code_id);
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found'
      });
    }

    if (!qrCode.isActive) {
      return res.status(400).json({
        success: false,
        message: 'QR code is not active'
      });
    }

    // Check if user is within geofence
    console.log('QR Code data:', {
      id: qrCode.id,
      locationLat: qrCode.locationLat,
      locationLng: qrCode.locationLng,
      geofenceRadius: qrCode.geofenceRadius,
      isActive: qrCode.isActive
    });
    console.log('User location:', { location_lat, location_lng });
    
    const isWithinGeofence = qrCode.isWithinGeofence(location_lat, location_lng);
    console.log('Is within geofence:', isWithinGeofence);
    
    if (!isWithinGeofence) {
      return res.status(400).json({
        success: false,
        message: 'You are not within the allowed area for this QR code'
      });
    }

    req.qrCode = qrCode;
    next();
  } catch (error) {
    console.error('Geolocation validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating location'
    });
  }
};

// GET /api/visitor/qr/:qr_data - Get QR code information
router.get('/qr/:qr_data', async (req, res) => {
  try {
    const { qr_data } = req.params;
    
    const qrCode = await QRCode.findOne({
      where: { qr_data, is_active: true }
    });

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found or inactive'
      });
    }

    // Check if QR code is operational
    const isOperational = qrCode.isOperational();
    if (!isOperational.operational) {
      return res.status(400).json({
        success: false,
        message: isOperational.reason
      });
    }

    res.json({
      success: true,
      data: {
        id: qrCode.id,
        entry_point: qrCode.entry_point,
        description: qrCode.description,
        location: {
          lat: qrCode.location_lat,
          lng: qrCode.location_lng
        },
        geofence_radius: qrCode.geofence_radius,
        security_level: qrCode.security_level,
        requires_approval: qrCode.requires_approval,
        operating_hours: qrCode.operating_hours
      }
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving QR code information'
    });
  }
});

// POST /api/visitor/register - Register new visitor
router.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { name, phone, purpose, location_lat, location_lng } = req.body;

    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone number are required'
      });
    }

    // Optional location validation
    if (location_lat && location_lng) {
      // Basic coordinate validation
      if (isNaN(location_lat) || isNaN(location_lng)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid location coordinates'
        });
      }
    }

    // Handle photo upload
    let photoUrl = null;
    if (req.file) {
      photoUrl = `/uploads/visitor-photos/${req.file.filename}`;
    }

    // Auto-approve all registrations for simplified flow
    const status = 'approved';
    const approvedBy = 'system';
    const approvedAt = new Date();

    // Create visitor registration
    const registration = await VisitorRegistration.create({
      name,
      phone,
      photoUrl: photoUrl,
      purpose: purpose || 'Visit',
      entryPoint: 'Main Gate', // Default entry point
      locationLat: location_lat ? parseFloat(location_lat) : null,
      locationLng: location_lng ? parseFloat(location_lng) : null,
      qrCodeId: null, // No QR code required
      status,
      approvedBy: approvedBy,
      approvedAt: approvedAt,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      createdBy: 'visitor-app'
    });

    // No QR code usage tracking needed

    res.status(201).json({
      success: true,
      message: status === 'approved' ? 'Registration approved automatically' : 'Registration submitted for approval',
      data: {
        id: registration.id,
        name: registration.name,
        phone: registration.phone,
        entry_point: registration.entry_point,
        status: registration.status,
        expiresAt: registration.expiresAt,
        created_at: registration.created_at
      }
    });
  } catch (error) {
    console.error('Visitor registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing registration'
    });
  }
});

// GET /api/visitor/registration/:id - Get registration status
router.get('/registration/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const registration = await VisitorRegistration.findByPk(id, {
      include: [{
        model: QRCode,
        as: 'qrCode',
        attributes: ['entry_point', 'description', 'security_level']
      }]
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: registration.id,
        name: registration.name,
        phone: registration.phone,
        photo_url: registration.photo_url,
        purpose: registration.purpose,
        entry_point: registration.entry_point,
        status: registration.status,
        approvedBy: registration.approvedBy,
        approvedAt: registration.approvedAt,
        rejectedBy: registration.rejectedBy,
        rejectedAt: registration.rejectedAt,
        rejectionReason: registration.rejectionReason,
        expiresAt: registration.expiresAt,
        checkedInAt: registration.checkedInAt,
        checkedOutAt: registration.checkedOutAt,
        created_at: registration.created_at,
        qr_code: registration.QRCode
      }
    });
  } catch (error) {
    console.error('Get registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving registration'
    });
  }
});

// GET /api/visitor/registrations - Get visitor registrations (for admin)
router.get('/registrations', async (req, res) => {
  try {
    const { 
      status, 
      entry_point, 
      page = 1, 
      limit = 20, 
      search,
      date_from,
      date_to
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters
    if (status) {
      where.status = status;
    }
    
    if (entry_point) {
      where.entry_point = entry_point;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) {
        where.created_at[Op.gte] = new Date(date_from);
      }
      if (date_to) {
        where.created_at[Op.lte] = new Date(date_to);
      }
    }

    const { count, rows } = await VisitorRegistration.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        registrations: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving registrations'
    });
  }
});

// PUT /api/visitor/registration/:id/approve - Approve registration
router.put('/registration/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;

    const registration = await VisitorRegistration.findByPk(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Registration is not pending approval'
      });
    }

    await registration.update({
      status: 'approved',
      approvedBy: approved_by || 'admin',
      approvedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Registration approved successfully',
      data: {
        id: registration.id,
        status: registration.status,
        approvedBy: registration.approvedBy,
        approvedAt: registration.approvedAt
      }
    });
  } catch (error) {
    console.error('Approve registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving registration'
    });
  }
});

// PUT /api/visitor/registration/:id/reject - Reject registration
router.put('/registration/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejected_by, rejection_reason } = req.body;

    const registration = await VisitorRegistration.findByPk(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Registration is not pending approval'
      });
    }

    await registration.update({
      status: 'rejected',
      rejectedBy: rejected_by || 'admin',
      rejectedAt: new Date(),
      rejectionReason: rejection_reason || 'No reason provided'
    });

    res.json({
      success: true,
      message: 'Registration rejected successfully',
      data: {
        id: registration.id,
        status: registration.status,
        rejectedBy: registration.rejectedBy,
        rejectedAt: registration.rejectedAt,
        rejectionReason: registration.rejectionReason
      }
    });
  } catch (error) {
    console.error('Reject registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting registration'
    });
  }
});

// PUT /api/visitor/registration/:id/checkin - Check in visitor
router.put('/registration/:id/checkin', async (req, res) => {
  try {
    const { id } = req.params;
    
    const registration = await VisitorRegistration.findByPk(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Registration must be approved before check-in'
      });
    }

    if (registration.checkedInAt) {
      return res.status(400).json({
        success: false,
        message: 'Visitor is already checked in'
      });
    }

    // Check if registration is expired
    if (registration.expiresAt && new Date() > registration.expiresAt) {
      await registration.update({ status: 'expired' });
      return res.status(400).json({
        success: false,
        message: 'Registration has expired'
      });
    }

    await registration.update({
      checkedInAt: new Date(),
      status: 'checked_in'
    });

    res.json({
      success: true,
      message: 'Visitor checked in successfully',
      data: {
        id: registration.id,
        checkedInAt: registration.checkedInAt
      }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking in visitor'
    });
  }
});

// PUT /api/visitor/registration/:id/checkout - Check out visitor
router.put('/registration/:id/checkout', async (req, res) => {
  try {
    const { id } = req.params;
    
    const registration = await VisitorRegistration.findByPk(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (!registration.checkedInAt) {
      return res.status(400).json({
        success: false,
        message: 'Visitor must be checked in before check-out'
      });
    }

    if (registration.checkedOutAt) {
      return res.status(400).json({
        success: false,
        message: 'Visitor is already checked out'
      });
    }

    await registration.update({
      checkedOutAt: new Date(),
      status: 'checked_out'
    });

    res.json({
      success: true,
      message: 'Visitor checked out successfully',
      data: {
        id: registration.id,
        checkedOutAt: registration.checkedOutAt
      }
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking out visitor'
    });
  }
});

// GET /api/visitor/stats - Get visitor statistics
router.get('/stats', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const where = {};

    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) {
        where.created_at[Op.gte] = new Date(date_from);
      }
      if (date_to) {
        where.created_at[Op.lte] = new Date(date_to);
      }
    }

    const [totalRegistrations, pendingCount, approvedCount, rejectedCount, checkedInCount] = await Promise.all([
      VisitorRegistration.count({ where }),
      VisitorRegistration.count({ where: { ...where, status: 'pending' } }),
      VisitorRegistration.count({ where: { ...where, status: 'approved' } }),
      VisitorRegistration.count({ where: { ...where, status: 'rejected' } }),
      VisitorRegistration.count({ where: { ...where, checkedInAt: { [Op.not]: null } } })
    ]);

    const entryPointStats = await VisitorRegistration.findAll({
      where,
      attributes: [
        'entry_point',
        [VisitorRegistration.sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['entry_point'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        total_registrations: totalRegistrations,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        checked_in: checkedInCount,
        by_entry_point: entryPointStats
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving statistics'
    });
  }
});

module.exports = router;