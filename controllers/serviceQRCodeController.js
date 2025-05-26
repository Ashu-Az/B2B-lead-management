// controllers/serviceQRCodeController.js
const ServiceQRCode = require('../models/ServiceQRCode');
const Service = require('../models/Service');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');


exports.generateServiceQRCode = async (req, res) => {
  try {
    const { name, description, frontendUrl, services } = req.body;

    // Validate input
    if (
      !name ||
      !services ||
      !Array.isArray(services) ||
      services.length === 0 ||
      !frontendUrl
    ) {
      return res.status(400).json({
        message: "Name, at least one service, and frontend URL are required",
        status: 400,
      });
    }

    // Validate services
    for (const serviceItem of services) {
      if (!serviceItem.service) {
        return res.status(400).json({
          message: "Service ID is required for each service",
          status: 400,
        });
      }

      // Check if service exists
      const serviceExists = await Service.exists({ _id: serviceItem.service });
      if (!serviceExists) {
        return res.status(404).json({
          message: `Service with ID ${serviceItem.service} not found`,
          status: 404,
        });
      }
    }

    // Generate a unique UUID for the uniqueId field
    const uniqueId = uuidv4();

    // Create temporary QR code object to get an ID
    const tempServiceQRCode = new ServiceQRCode({
      uniqueId: uniqueId,
      name,
      description,
      frontendUrl,
      services,
      qrCodeImage: "temp", // Temporary value to pass validation
      createdBy: req.user.id,
      isActive: true,
    });

    // Save to get the _id
    const savedQRCode = await tempServiceQRCode.save();
    
    // Now create the QR code URL that points to your backend API
    // Use your actual domain instead of req.get('host') for production
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const qrCodeUrl = `${backendUrl}/api/customer/service-portal?qrId=${savedQRCode._id}`;
    
    console.log("Generated QR code URL:", qrCodeUrl);

    // Generate QR code image with the backend URL
    const qrCodeImage = await qrcode.toDataURL(qrCodeUrl);

    // Update the QR code with the actual image
    savedQRCode.qrCodeImage = qrCodeImage;
    await savedQRCode.save();

    // For the response, show what the final redirect URL will be
    const populatedServices = await Promise.all(
      services.map(async (serviceItem) => {
        const serviceData = await Service.findById(serviceItem.service);
        return {
          name: serviceData.name,
          type: serviceData.serviceType,
          url: serviceData.serviceData,
          displayOrder: serviceItem.displayOrder || 0,
        };
      })
    );

    populatedServices.sort((a, b) => a.displayOrder - b.displayOrder);

    let serviceParams = "";
    populatedServices.forEach((service, index) => {
      serviceParams += `${index === 0 ? "?" : "&"}service_${service.name}=${service.url}`;
    });

    let baseUrl = frontendUrl;
    if (!baseUrl.endsWith("/")) {
      baseUrl += "/";
    }
    baseUrl += name;

    const finalRedirectUrl = `${baseUrl}${serviceParams}`;

    res.status(201).json({
      message: "Service QR code generated successfully",
      data: {
        qrCode: savedQRCode,
        qrCodeUrl: qrCodeUrl, // The URL that's actually in the QR code
        finalRedirectUrl: finalRedirectUrl, // Where users will end up after scanning
      },
      status: 201,
    });
  } catch (error) {
    console.error("Generate service QR code error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      status: 500,
    });
  }
};

exports.getAllServiceQRCodes = async (req, res) => {
  try {
    const { serviceType, isActive } = req.query;
    
    // Build filter
    const filter = {};
    
    // Add active status filter if provided
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Get all QR codes
    let serviceQRCodes = await ServiceQRCode.find(filter)
      .populate({
        path: 'services.service',
        select: 'name serviceType serviceData isActive'
      })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    // Filter by service type if provided
    if (serviceType) {
      serviceQRCodes = serviceQRCodes.filter(qrCode => 
        qrCode.services.some(serviceItem => 
          serviceItem.service && serviceItem.service.serviceType === serviceType
        )
      );
    }
    
    res.json({
      data: serviceQRCodes,
      count: serviceQRCodes.length,
      status: 200
    });
  } catch (error) {
    console.error('Get all service QR codes error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

exports.updateServiceQRCode = async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    const { name, description, services, frontendUrl, isActive } = req.body;

    const serviceQRCode = await ServiceQRCode.findById(qrCodeId);

    if (!serviceQRCode) {
      return res.status(404).json({
        message: "Service QR code not found",
        status: 404,
      });
    }

    // Update basic fields if provided
    if (name) serviceQRCode.name = name;
    if (description !== undefined) serviceQRCode.description = description;
    if (isActive !== undefined) serviceQRCode.isActive = isActive;
    if (frontendUrl) serviceQRCode.frontendUrl = frontendUrl;

    // Update services if provided
    if (services && Array.isArray(services) && services.length > 0) {
      // Validate each service
      for (const serviceItem of services) {
        if (!serviceItem.service) {
          return res.status(400).json({
            message: "Service ID is required for each service",
            status: 400,
          });
        }

        // Check if service exists
        const serviceExists = await Service.exists({
          _id: serviceItem.service,
        });
        if (!serviceExists) {
          return res.status(404).json({
            message: `Service with ID ${serviceItem.service} not found`,
            status: 404,
          });
        }
      }

      serviceQRCode.services = services;
    }

    // Regenerate QR code if name, frontendUrl, or services changed
    if (name || frontendUrl || (services && services.length > 0)) {
      // Populate service details to create the QR URL
      const populatedServices = await Promise.all(
        serviceQRCode.services.map(async (serviceItem) => {
          const serviceData = await Service.findById(serviceItem.service);
          return {
            name: serviceData.name,
            type: serviceData.serviceType,
            url: serviceData.serviceData,
            displayOrder: serviceItem.displayOrder || 0,
          };
        })
      );

      // Sort services by display order
      populatedServices.sort((a, b) => a.displayOrder - b.displayOrder);

      // Create URL parameters for services
      let serviceParams = "";
      populatedServices.forEach((service, index) => {
        serviceParams += `${index === 0 ? "?" : "&"}service_${service.name}=${
          service.url
        }`;
      });

      // Build base redirect URL
      let baseUrl = serviceQRCode.frontendUrl;
      if (!baseUrl.endsWith("/")) {
        baseUrl += "/";
      }
      baseUrl += serviceQRCode.name;

      const redirectUrl = `${baseUrl}${serviceParams}`;
      
      // Generate new QR code image with the updated redirect URL
      serviceQRCode.qrCodeImage = await qrcode.toDataURL(redirectUrl);
    }

    serviceQRCode.updatedAt = new Date();

    await serviceQRCode.save();

    res.json({
      message: "Service QR code updated successfully",
      data: serviceQRCode,
      status: 200,
    });
  } catch (error) {
    console.error("Update service QR code error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      status: 500,
    });
  }
};

// Delete service QR code
exports.deleteServiceQRCode = async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    
    const serviceQRCode = await ServiceQRCode.findById(qrCodeId);
    
    if (!serviceQRCode) {
      return res.status(404).json({
        message: 'Service QR code not found',
        status: 404
      });
    }
    
    await ServiceQRCode.deleteOne({ _id: qrCodeId });
    
    res.json({
      message: 'Service QR code deleted successfully',
      status: 200
    });
  } catch (error) {
    console.error('Delete service QR code error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

exports.getServiceQRCodeById = async (req, res) => {
    try {
      const { qrCodeId } = req.params;
      
      const serviceQRCode = await ServiceQRCode.findById(qrCodeId)
        .populate({
          path: 'services.service',
          select: 'name serviceType serviceData isActive'
        })
        .populate('createdBy', 'name email');
      
      if (!serviceQRCode) {
        return res.status(404).json({
          message: 'Service QR code not found',
          status: 404
        });
      }
      
      res.json({
        data: serviceQRCode,
        status: 200
      });
    } catch (error) {
      console.error('Get service QR code error:', error);
      res.status(500).json({
        message: 'Server error',
        error: error.message,
        status: 500
      });
    }
  };

// Get statistics for service QR codes
exports.getServiceQRCodeStats = async (req, res) => {
  try {
    // Get basic counts
    const stats = {
      total: await ServiceQRCode.countDocuments(),
      active: await ServiceQRCode.countDocuments({ isActive: true }),
      inactive: await ServiceQRCode.countDocuments({ isActive: false }),
      totalScans: 0,
      topScanned: [],
      serviceTypeBreakdown: {}
    };
    
    // Get all service types
    const serviceTypes = await Service.distinct('serviceType');
    serviceTypes.forEach(type => {
      stats.serviceTypeBreakdown[type] = 0;
    });
    
    // Get all QR codes with their services
    const allQRCodes = await ServiceQRCode.find().populate('services.service');
    
    // Count service types and total scans
    allQRCodes.forEach(qrCode => {
      stats.totalScans += qrCode.scans;
      
      // Count service types
      qrCode.services.forEach(serviceItem => {
        if (serviceItem.service && serviceItem.service.serviceType) {
          const type = serviceItem.service.serviceType;
          stats.serviceTypeBreakdown[type] = (stats.serviceTypeBreakdown[type] || 0) + 1;
        }
      });
    });
    
    // Get top 5 most scanned QR codes
    stats.topScanned = await ServiceQRCode.find()
      .sort({ scans: -1 })
      .limit(5)
      .select('name scans lastScannedAt');
    
    res.json({
      data: stats,
      status: 200
    });
  } catch (error) {
    console.error('Get service QR code stats error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};