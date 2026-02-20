const Joi = require('joi');
const languageCache = require('../utils/languageCache');

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        error: 'Validation Error',
        details: errorMessages
      });
    }

    // Replace request property with validated value
    req[property] = value;
    next();
  };
};

/**
 * Dynamic validation middleware that validates multilingual fields
 * against the active languages from the database
 */
const validateMultilingual = (schema, property = 'body') => {
  return async (req, res, next) => {
    try {
      // Get active languages for dynamic validation
      const languages = await languageCache.getActiveLanguages();
      const defaultLang = await languageCache.getDefaultLanguageCode();
      const languageCodes = languages.map(l => l.code);

      // Build dynamic multilingual schema
      const dynamicSchema = buildDynamicSchema(schema, languageCodes, defaultLang);

      const { error, value } = dynamicSchema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(400).json({
          error: 'Validation Error',
          details: errorMessages
        });
      }

      // Replace request property with validated value
      req[property] = value;
      
      // Attach language info to request for use in routes
      req.activeLanguages = languageCodes;
      req.defaultLanguage = defaultLang;
      
      next();
    } catch (err) {
      console.error('Multilingual validation error:', err);
      return res.status(500).json({ error: 'Validation failed' });
    }
  };
};

/**
 * Build dynamic multilingual field schema
 * @param {Object} baseSchema - Base schema definition
 * @param {Array} languageCodes - Active language codes
 * @param {string} defaultLang - Default language code
 */
const buildDynamicSchema = (baseSchema, languageCodes, defaultLang) => {
  // For now, return the base schema as Joi doesn't easily support
  // dynamic schema building. We'll validate multilingual fields
  // in the route handlers or model validators.
  return baseSchema;
};

/**
 * Create a multilingual object schema
 * Allows any language code as key, requires default language
 */
const multilingualString = (required = false, minLength = 1, maxLength = 500) => {
  return Joi.object().pattern(
    Joi.string().min(2).max(10), // language code pattern
    Joi.string().min(minLength).max(maxLength).allow('')
  ).min(required ? 1 : 0);
};

/**
 * Create validation for language code against active languages
 */
const validateLanguageCode = async (code) => {
  const codes = await languageCache.getActiveLanguageCodes();
  return codes.includes(code);
};

// Common validation schemas
const schemas = {
  // Auth schemas
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // User schemas
  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100),
    avatar: Joi.string().uri().allow(null, ''),
    bio: Joi.string().max(500).allow(null, '')
  }),

  updatePreferences: Joi.object({
    language: Joi.string().min(2).max(10), // Dynamic validation in route
    city: Joi.string().hex().length(24).allow(null),
    area: Joi.string().hex().length(24).allow(null),
    categories: Joi.array().items(Joi.string().hex().length(24))
  }),

  // Category schemas - now accepts dynamic language keys
  createCategory: Joi.object({
    name: Joi.object().pattern(
      Joi.string(), // Any language code
      Joi.string().min(2).max(100)
    ).required(),
    description: Joi.object().pattern(
      Joi.string(),
      Joi.string().max(500).allow('')
    ),
    parent: Joi.string().hex().length(24).allow(null),
    icon: Joi.string().allow(null, ''),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).allow(null, ''),
    image: Joi.string().uri().allow(null, ''),
    order: Joi.number().integer().min(0),
    isActive: Joi.boolean(),
    isFeatured: Joi.boolean()
  }),

  // Article schemas - now accepts dynamic language keys
  createArticle: Joi.object({
    title: Joi.object().pattern(
      Joi.string(),
      Joi.string().min(5).max(200)
    ).required(),
    summary: Joi.object().pattern(
      Joi.string(),
      Joi.string().max(500).allow('')
    ).allow(null),
    content: Joi.object().pattern(
      Joi.string(),
      Joi.string().max(10000)
    ).required(),
    category: Joi.string().hex().length(24).allow(null, ''),
    featuredImage: Joi.object({
      url: Joi.string().uri(),
      caption: Joi.object().pattern(
        Joi.string(),
        Joi.string()
      ),
      alt: Joi.string()
    }),
    images: Joi.array().items(Joi.object({
      url: Joi.string().uri(),
      caption: Joi.object().pattern(
        Joi.string(),
        Joi.string()
      ),
      alt: Joi.string(),
      order: Joi.number()
    })),
    location: Joi.object({
      type: Joi.string().valid('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2),
      formattedAddress: Joi.string().allow('', null),
      city: Joi.string().allow('', null),
      area: Joi.string().allow('', null),
      state: Joi.string().allow('', null),
      country: Joi.string().allow('', null),
      pincode: Joi.string().allow('', null),
      placeId: Joi.string().allow('', null)
    }).allow(null),
    audio: Joi.object().pattern(
      Joi.string(),
      Joi.string().uri().allow('')
    ).allow(null),
    tags: Joi.array().items(Joi.string().max(50)),
    status: Joi.string().valid('draft', 'pending', 'published', 'archived'),
    isFeatured: Joi.boolean(),
    isBreaking: Joi.boolean(),
    isPremium: Joi.boolean()
  }),

  // Comment schemas
  createComment: Joi.object({
    content: Joi.string().min(1).max(1000).required(),
    parent: Joi.string().hex().length(24).allow(null)
  }),

  // Location schemas - now accepts dynamic language keys
  createCity: Joi.object({
    name: Joi.object().pattern(
      Joi.string(),
      Joi.string().min(2).max(100)
    ).required(),
    state: Joi.object().pattern(
      Joi.string(),
      Joi.string().min(2).max(100)
    ).required(),
    center: Joi.object({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2).required()
    }).required(),
    location: Joi.object({
      type: Joi.string().valid('Point', 'Polygon'),
      coordinates: Joi.alternatives().try(
        Joi.array().items(Joi.number()).length(2),
        Joi.array().items(Joi.array().items(Joi.array().items(Joi.number())))
      )
    }),
    timezone: Joi.string(),
    population: Joi.number().integer().min(0),
    isActive: Joi.boolean(),
    isFeatured: Joi.boolean(),
    order: Joi.number().integer().min(0)
  }),

  createArea: Joi.object({
    name: Joi.object().pattern(
      Joi.string(),
      Joi.string().min(2).max(100)
    ).required(),
    city: Joi.string().hex().length(24).required(),
    center: Joi.object({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2).required()
    }).required(),
    boundary: Joi.object({
      type: Joi.string().valid('Polygon'),
      coordinates: Joi.array().items(Joi.array().items(Joi.array().items(Joi.number())))
    }),
    pincode: Joi.string().max(10),
    pincodes: Joi.array().items(Joi.string().max(10)),
    isActive: Joi.boolean(),
    isFeatured: Joi.boolean(),
    order: Joi.number().integer().min(0)
  }),

  // Language schemas
  createLanguage: Joi.object({
    code: Joi.string().min(2).max(10).required(),
    name: Joi.string().min(2).max(50).required(),
    nativeName: Joi.string().min(2).max(50).required(),
    isRTL: Joi.boolean(),
    order: Joi.number().integer().min(0)
  }),

  updateLanguage: Joi.object({
    name: Joi.string().min(2).max(50),
    nativeName: Joi.string().min(2).max(50),
    isActive: Joi.boolean(),
    isRTL: Joi.boolean(),
    order: Joi.number().integer().min(0)
  }),

  // Query params
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string(),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  articleQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    category: Joi.string().hex().length(24),
    city: Joi.string().hex().length(24),
    area: Joi.string().hex().length(24),
    status: Joi.string().valid('draft', 'pending', 'published', 'archived'),
    featured: Joi.boolean(),
    breaking: Joi.boolean(),
    author: Joi.string().hex().length(24),
    search: Joi.string().max(200),
    lang: Joi.string().min(2).max(10).default('en') // Any valid language code
  }),

  // Object ID param
  objectId: Joi.object({
    id: Joi.string().hex().length(24).required()
  })
};

module.exports = {
  validate,
  validateMultilingual,
  validateLanguageCode,
  multilingualString,
  schemas
};
