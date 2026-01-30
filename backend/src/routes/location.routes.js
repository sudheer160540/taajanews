const express = require('express');
const router = express.Router();
const City = require('../models/City');
const Area = require('../models/Area');
const { protect, adminOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const languageCache = require('../utils/languageCache');

// Helper to get value from Map or plain object
const getLocalizedValue = (field, lang, fallbackLang = 'en') => {
  if (!field) return '';
  if (field instanceof Map) {
    return field.get(lang) || field.get(fallbackLang) || [...field.values()][0] || '';
  }
  // Plain object (from lean query)
  return field[lang] || field[fallbackLang] || Object.values(field)[0] || '';
};

// Transform city for localized response
const transformCity = (city, lang, fallbackLang) => {
  if (!city) return null;
  return {
    ...city,
    name: getLocalizedValue(city.name, lang, fallbackLang),
    state: getLocalizedValue(city.state, lang, fallbackLang),
    _multilingual: {
      name: city.name,
      state: city.state
    }
  };
};

// Transform area for localized response
const transformArea = (area, lang, fallbackLang) => {
  if (!area) return null;
  return {
    ...area,
    name: getLocalizedValue(area.name, lang, fallbackLang),
    city: area.city ? transformCity(area.city, lang, fallbackLang) : null,
    _multilingual: {
      name: area.name
    }
  };
};

// ============ CITIES ============

// @route   GET /api/locations/cities
// @desc    Get all cities
// @access  Public
router.get('/cities', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { state, featured, search, lang = defaultLang, raw } = req.query;

    const query = { isActive: true };
    if (featured === 'true') query.isFeatured = true;

    let cities = await City.find(query)
      .sort({ isFeatured: -1, order: 1 })
      .lean();

    // Filter by state or search (search in all language values)
    if (state || search) {
      cities = cities.filter(city => {
        if (state) {
          const stateValues = city.state ? Object.values(city.state) : [];
          const stateMatch = stateValues.some(v => new RegExp(state, 'i').test(v));
          if (!stateMatch) return false;
        }
        if (search) {
          const nameValues = city.name ? Object.values(city.name) : [];
          const nameMatch = nameValues.some(v => new RegExp(search, 'i').test(v));
          if (!nameMatch) return false;
        }
        return true;
      });
    }

    // If raw=true, return full multilingual data
    if (raw === 'true') {
      return res.json({ cities });
    }

    res.json({ cities: cities.map(c => transformCity(c, lang, defaultLang)) });
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// @route   GET /api/locations/cities/nearby
// @desc    Get cities near coordinates
// @access  Public
router.get('/cities/nearby', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lng, lat, distance = 100000, limit = 10, lang = defaultLang } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ error: 'Longitude and latitude are required' });
    }

    const cities = await City.findNearby(
      [parseFloat(lng), parseFloat(lat)],
      parseInt(distance),
      parseInt(limit)
    );

    // Convert to plain objects and transform
    const transformedCities = cities.map(c => transformCity(c.toObject(), lang, defaultLang));

    res.json({ cities: transformedCities });
  } catch (error) {
    console.error('Get nearby cities error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby cities' });
  }
});

// @route   GET /api/locations/cities/:id
// @desc    Get city by ID
// @access  Public
router.get('/cities/:id', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lang = defaultLang, raw } = req.query;

    const city = await City.findById(req.params.id).lean();
    
    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    // Get areas in this city
    const areas = await Area.find({ city: city._id, isActive: true })
      .sort({ isFeatured: -1, order: 1 })
      .lean();

    if (raw === 'true') {
      return res.json({ city, areas });
    }

    res.json({ 
      city: transformCity(city, lang, defaultLang), 
      areas: areas.map(a => transformArea(a, lang, defaultLang))
    });
  } catch (error) {
    console.error('Get city error:', error);
    res.status(500).json({ error: 'Failed to fetch city' });
  }
});

// @route   GET /api/locations/cities/slug/:slug
// @desc    Get city by slug
// @access  Public
router.get('/cities/slug/:slug', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lang = defaultLang } = req.query;

    const city = await City.findOne({ slug: req.params.slug }).lean();
    
    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    const areas = await Area.find({ city: city._id, isActive: true })
      .sort({ isFeatured: -1, order: 1 })
      .lean();

    res.json({ 
      city: transformCity(city, lang, defaultLang), 
      areas: areas.map(a => transformArea(a, lang, defaultLang))
    });
  } catch (error) {
    console.error('Get city by slug error:', error);
    res.status(500).json({ error: 'Failed to fetch city' });
  }
});

// @route   POST /api/locations/cities
// @desc    Create city
// @access  Private/Admin
router.post('/cities', protect, adminOnly, validate(schemas.createCity), async (req, res) => {
  try {
    // Convert plain objects to Maps for multilingual fields
    const cityData = {
      ...req.body,
      name: new Map(Object.entries(req.body.name || {})),
      state: new Map(Object.entries(req.body.state || {}))
    };

    const city = await City.create(cityData);
    res.status(201).json({
      message: 'City created',
      city
    });
  } catch (error) {
    console.error('Create city error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'City already exists' });
    }
    res.status(500).json({ error: 'Failed to create city' });
  }
});

// @route   PUT /api/locations/cities/:id
// @desc    Update city
// @access  Private/Admin
router.put('/cities/:id', protect, adminOnly, async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Convert multilingual fields to Maps
    if (updateData.name) {
      updateData.name = new Map(Object.entries(updateData.name));
    }
    if (updateData.state) {
      updateData.state = new Map(Object.entries(updateData.state));
    }

    const city = await City.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    res.json({
      message: 'City updated',
      city
    });
  } catch (error) {
    console.error('Update city error:', error);
    res.status(500).json({ error: 'Failed to update city' });
  }
});

// @route   DELETE /api/locations/cities/:id
// @desc    Delete city (soft)
// @access  Private/Admin
router.delete('/cities/:id', protect, adminOnly, async (req, res) => {
  try {
    const city = await City.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    // Also deactivate all areas in this city
    await Area.updateMany({ city: city._id }, { isActive: false });

    res.json({ message: 'City deactivated' });
  } catch (error) {
    console.error('Delete city error:', error);
    res.status(500).json({ error: 'Failed to delete city' });
  }
});

// ============ AREAS ============

// @route   GET /api/locations/areas
// @desc    Get areas (optionally by city)
// @access  Public
router.get('/areas', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { city, featured, search, lang = defaultLang, raw } = req.query;

    const query = { isActive: true };
    if (city) query.city = city;
    if (featured === 'true') query.isFeatured = true;

    let areas = await Area.find(query)
      .populate('city', 'name slug')
      .sort({ isFeatured: -1, order: 1 })
      .lean();

    // Filter by search
    if (search) {
      areas = areas.filter(area => {
        const nameValues = area.name ? Object.values(area.name) : [];
        const nameMatch = nameValues.some(v => new RegExp(search, 'i').test(v));
        const pincodeMatch = area.pincode && new RegExp(search, 'i').test(area.pincode);
        return nameMatch || pincodeMatch;
      });
    }

    if (raw === 'true') {
      return res.json({ areas });
    }

    res.json({ areas: areas.map(a => transformArea(a, lang, defaultLang)) });
  } catch (error) {
    console.error('Get areas error:', error);
    res.status(500).json({ error: 'Failed to fetch areas' });
  }
});

// @route   GET /api/locations/areas/nearby
// @desc    Get areas near coordinates
// @access  Public
router.get('/areas/nearby', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lng, lat, distance = 5000, limit = 10, lang = defaultLang } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ error: 'Longitude and latitude are required' });
    }

    const areas = await Area.findNearby(
      [parseFloat(lng), parseFloat(lat)],
      parseInt(distance),
      parseInt(limit)
    );

    // Convert to plain objects and transform
    const transformedAreas = areas.map(a => {
      const areaObj = a.toObject();
      return transformArea(areaObj, lang, defaultLang);
    });

    res.json({ areas: transformedAreas });
  } catch (error) {
    console.error('Get nearby areas error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby areas' });
  }
});

// @route   GET /api/locations/areas/:id
// @desc    Get area by ID
// @access  Public
router.get('/areas/:id', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lang = defaultLang, raw } = req.query;

    const area = await Area.findById(req.params.id)
      .populate('city', 'name slug state')
      .lean();
    
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    if (raw === 'true') {
      return res.json({ area });
    }

    res.json({ area: transformArea(area, lang, defaultLang) });
  } catch (error) {
    console.error('Get area error:', error);
    res.status(500).json({ error: 'Failed to fetch area' });
  }
});

// @route   POST /api/locations/areas
// @desc    Create area
// @access  Private/Admin
router.post('/areas', protect, adminOnly, validate(schemas.createArea), async (req, res) => {
  try {
    // Verify city exists
    const city = await City.findById(req.body.city);
    if (!city) {
      return res.status(400).json({ error: 'Invalid city' });
    }

    // Convert plain objects to Maps for multilingual fields
    const areaData = {
      ...req.body,
      name: new Map(Object.entries(req.body.name || {}))
    };

    const area = await Area.create(areaData);
    res.status(201).json({
      message: 'Area created',
      area
    });
  } catch (error) {
    console.error('Create area error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Area already exists in this city' });
    }
    res.status(500).json({ error: 'Failed to create area' });
  }
});

// @route   PUT /api/locations/areas/:id
// @desc    Update area
// @access  Private/Admin
router.put('/areas/:id', protect, adminOnly, async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Convert multilingual fields to Maps
    if (updateData.name) {
      updateData.name = new Map(Object.entries(updateData.name));
    }

    const area = await Area.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    res.json({
      message: 'Area updated',
      area
    });
  } catch (error) {
    console.error('Update area error:', error);
    res.status(500).json({ error: 'Failed to update area' });
  }
});

// @route   DELETE /api/locations/areas/:id
// @desc    Delete area (soft)
// @access  Private/Admin
router.delete('/areas/:id', protect, adminOnly, async (req, res) => {
  try {
    const area = await Area.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    res.json({ message: 'Area deactivated' });
  } catch (error) {
    console.error('Delete area error:', error);
    res.status(500).json({ error: 'Failed to delete area' });
  }
});

// @route   GET /api/locations/states
// @desc    Get unique states
// @access  Public
router.get('/states', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lang = defaultLang } = req.query;

    // Get all cities and extract unique states
    const cities = await City.find({ isActive: true }).lean();
    
    const statesMap = new Map();
    cities.forEach(city => {
      if (city.state) {
        const stateKey = getLocalizedValue(city.state, 'en', 'en');
        if (!statesMap.has(stateKey)) {
          statesMap.set(stateKey, {
            name: city.state,
            cityCount: 1
          });
        } else {
          statesMap.get(stateKey).cityCount++;
        }
      }
    });

    const states = Array.from(statesMap.values()).map(s => ({
      name: getLocalizedValue(s.name, lang, defaultLang),
      _multilingual: { name: s.name },
      cityCount: s.cityCount
    })).sort((a, b) => a.name.localeCompare(b.name));

    res.json({ states });
  } catch (error) {
    console.error('Get states error:', error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
});

module.exports = router;
