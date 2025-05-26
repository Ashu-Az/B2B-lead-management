// controllers/serviceController.js
const Service = require('../models/Service');

// Create a new service
exports.createService = async (req, res) => {
  try {
    const { name, serviceType, serviceData, description } = req.body;
    
    // Validate required fields
    if (!name || !serviceType || !serviceData) {
      return res.status(400).json({
        message: 'Name, service type, and service data are required',
        status: 400
      });
    }
    
    // Create the service
    const service = new Service({
      name,
      serviceType,
      serviceData,
      description,
      createdBy: req.user.id,
      isActive: true
    });
    
    await service.save();
    
    res.status(201).json({
      message: 'Service created successfully',
      data: service,
      status: 201
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

// Get all services
exports.getAllServices = async (req, res) => {
  try {
    const { serviceType, isActive } = req.query;
    
    // Build filter
    const filter = {};
    
    // Add service type filter if provided
    if (serviceType) {
      filter.serviceType = serviceType;
    }
    
    // Add active status filter if provided
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Get services with filter
    const services = await Service.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      data: services,
      count: services.length,
      status: 200
    });
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({
      message: 'Server error', 
      error: error.message,
      status: 500
    });
  }
};

// Get service by ID
exports.getServiceById = async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    const service = await Service.findById(serviceId)
      .populate('createdBy', 'name email');
    
    if (!service) {
      return res.status(404).json({
        message: 'Service not found',
        status: 404
      });
    }
    
    res.json({
      data: service,
      status: 200
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

// Update service
exports.updateService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { name, serviceType, serviceData, description, isActive } = req.body;
    
    const service = await Service.findById(serviceId);
    
    if (!service) {
      return res.status(404).json({
        message: 'Service not found',
        status: 404
      });
    }
    
    // Update fields if provided
    if (name) service.name = name;
    if (serviceType) service.serviceType = serviceType;
    if (serviceData) service.serviceData = serviceData;
    if (description !== undefined) service.description = description;
    if (isActive !== undefined) service.isActive = isActive;
    
    service.updatedAt = new Date();
    
    await service.save();
    
    res.json({
      message: 'Service updated successfully',
      data: service,
      status: 200
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

// Delete service
exports.deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    const service = await Service.findById(serviceId);
    
    if (!service) {
      return res.status(404).json({
        message: 'Service not found',
        status: 404
      });
    }
    
    // Check if service is used in any service QR code
    const ServiceQRCode = require('../models/ServiceQRCode');
    const isUsed = await ServiceQRCode.exists({ 'services.service': serviceId });
    
    if (isUsed) {
      return res.status(400).json({
        message: 'Cannot delete service used in QR codes. Deactivate it instead.',
        status: 400
      });
    }
    
    await Service.deleteOne({ _id: serviceId });
    
    res.json({
      message: 'Service deleted successfully',
      status: 200
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

// Get unique service types
exports.getServiceTypes = async (req, res) => {
  try {
    const serviceTypes = await Service.distinct('serviceType');
    
    res.json({
      data: serviceTypes,
      count: serviceTypes.length,
      status: 200
    });
  } catch (error) {
    console.error('Get service types error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};