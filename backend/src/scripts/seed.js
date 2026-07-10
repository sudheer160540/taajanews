require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('../models/User');
const Category = require('../models/Category');
const City = require('../models/City');
const Area = require('../models/Area');
const Article = require('../models/Article');
const Language = require('../models/Language');

// Helper to convert plain object to Map
const toMap = (obj) => new Map(Object.entries(obj));

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('MongoDB connected for seeding');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Seed data
const categories = [
  {
    name: { te: 'రాజకీయాలు', en: 'Politics', hi: 'राजनीति' },
    description: { te: 'రాజకీయ వార్తలు మరియు అప్‌డేట్‌లు', en: 'Political news and updates', hi: 'राजनीतिक समाचार और अपडेट' },
    icon: 'gavel',
    color: '#d32f2f',
    order: 1,
    isFeatured: true
  },
  {
    name: { te: 'వ్యాపారం', en: 'Business', hi: 'व्यापार' },
    description: { te: 'వ్యాపార మరియు ఆర్థిక వార్తలు', en: 'Business and economy news', hi: 'व्यापार और अर्थव्यवस्था समाचार' },
    icon: 'business',
    color: '#1976d2',
    order: 2,
    isFeatured: true
  },
  {
    name: { te: 'క్రీడలు', en: 'Sports', hi: 'खेल' },
    description: { te: 'క్రీడా వార్తలు మరియు స్కోర్లు', en: 'Sports news and scores', hi: 'खेल समाचार और स्कोर' },
    icon: 'sports',
    color: '#388e3c',
    order: 3,
    isFeatured: true
  },
  {
    name: { te: 'వినోదం', en: 'Entertainment', hi: 'मनोरंजन' },
    description: { te: 'వినోద మరియు సెలబ్రిటీ వార్తలు', en: 'Entertainment and celebrity news', hi: 'मनोरंजन और सेलिब्रिटी समाचार' },
    icon: 'movie',
    color: '#7b1fa2',
    order: 4,
    isFeatured: true
  },
  {
    name: { te: 'టెక్నాలజీ', en: 'Technology', hi: 'प्रौद्योगिकी' },
    description: { te: 'టెక్ వార్తలు మరియు గాడ్జెట్‌లు', en: 'Tech news and gadgets', hi: 'टेक समाचार और गैजेट्स' },
    icon: 'computer',
    color: '#0288d1',
    order: 5,
    isFeatured: true
  },
  {
    name: { te: 'ఆరోగ్యం', en: 'Health', hi: 'स्वास्थ्य' },
    description: { te: 'ఆరోగ్య వార్తలు', en: 'Health and wellness news', hi: 'स्वास्थ्य और कल्याण समाचार' },
    icon: 'health_and_safety',
    color: '#00796b',
    order: 6,
    isFeatured: false
  },
  {
    name: { te: 'విద్య', en: 'Education', hi: 'शिक्षा' },
    description: { te: 'విద్యా వార్తలు మరియు అప్‌డేట్‌లు', en: 'Education news and updates', hi: 'शिक्षा समाचार और अपडेट' },
    icon: 'school',
    color: '#5d4037',
    order: 7,
    isFeatured: false
  },
  {
    name: { te: 'స్థానిక వార్తలు', en: 'Local News', hi: 'स्थानीय समाचार' },
    description: { te: 'మీ ప్రాంతం నుండి వార్తలు', en: 'News from your locality', hi: 'आपके क्षेत्र से समाचार' },
    icon: 'location_on',
    color: '#f57c00',
    order: 8,
    isFeatured: true
  }
];

const cities = [
  {
    name: { te: 'హైదరాబాద్', en: 'Hyderabad', hi: 'हैदराबाद' },
    state: { te: 'తెలంగాణ', en: 'Telangana', hi: 'तेलंगाना' },
    center: { type: 'Point', coordinates: [78.4867, 17.3850] },
    location: { type: 'Point', coordinates: [78.4867, 17.3850] },
    population: 6809970,
    isFeatured: true,
    order: 1
  },
  {
    name: { te: 'విజయవాడ', en: 'Vijayawada', hi: 'विजयवाड़ा' },
    state: { te: 'ఆంధ్ర ప్రదేశ్', en: 'Andhra Pradesh', hi: 'आंध्र प्रदेश' },
    center: { type: 'Point', coordinates: [80.6480, 16.5062] },
    location: { type: 'Point', coordinates: [80.6480, 16.5062] },
    population: 1048240,
    isFeatured: true,
    order: 2
  },
  {
    name: { te: 'విశాఖపట్నం', en: 'Visakhapatnam', hi: 'विशाखापत्तनम' },
    state: { te: 'ఆంధ్ర ప్రదేశ్', en: 'Andhra Pradesh', hi: 'आंध्र प्रदेश' },
    center: { type: 'Point', coordinates: [83.2185, 17.6868] },
    location: { type: 'Point', coordinates: [83.2185, 17.6868] },
    population: 2035922,
    isFeatured: true,
    order: 3
  },
  {
    name: { te: 'ఢిల్లీ', en: 'Delhi', hi: 'दिल्ली' },
    state: { te: 'ఢిల్లీ', en: 'Delhi', hi: 'दिल्ली' },
    center: { type: 'Point', coordinates: [77.2090, 28.6139] },
    location: { type: 'Point', coordinates: [77.2090, 28.6139] },
    population: 16787941,
    isFeatured: true,
    order: 4
  },
  {
    name: { te: 'ముంబై', en: 'Mumbai', hi: 'मुंबई' },
    state: { te: 'మహారాష్ట్ర', en: 'Maharashtra', hi: 'महाराष्ट्र' },
    center: { type: 'Point', coordinates: [72.8777, 19.0760] },
    location: { type: 'Point', coordinates: [72.8777, 19.0760] },
    population: 12442373,
    isFeatured: true,
    order: 5
  },
  {
    name: { te: 'బెంగళూరు', en: 'Bangalore', hi: 'बेंगलुरु' },
    state: { te: 'కర్ణాటక', en: 'Karnataka', hi: 'कर्नाटक' },
    center: { type: 'Point', coordinates: [77.5946, 12.9716] },
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    population: 8443675,
    isFeatured: true,
    order: 6
  },
  {
    name: { te: 'చెన్నై', en: 'Chennai', hi: 'चेन्नई' },
    state: { te: 'తమిళనాడు', en: 'Tamil Nadu', hi: 'तमिलनाडु' },
    center: { type: 'Point', coordinates: [80.2707, 13.0827] },
    location: { type: 'Point', coordinates: [80.2707, 13.0827] },
    population: 4681087,
    isFeatured: false,
    order: 7
  },
  {
    name: { te: 'కోల్‌కతా', en: 'Kolkata', hi: 'कोलकाता' },
    state: { te: 'పశ్చిమ బెంగాల్', en: 'West Bengal', hi: 'पश्चिम बंगाल' },
    center: { type: 'Point', coordinates: [88.3639, 22.5726] },
    location: { type: 'Point', coordinates: [88.3639, 22.5726] },
    population: 4496694,
    isFeatured: false,
    order: 8
  },
  {
    name: { te: 'తిరుపతి', en: 'Tirupati', hi: 'तिरुपति' },
    state: { te: 'ఆంధ్ర ప్రదేశ్', en: 'Andhra Pradesh', hi: 'आंध्र प्रदेश' },
    center: { type: 'Point', coordinates: [79.4192, 13.6288] },
    location: { type: 'Point', coordinates: [79.4192, 13.6288] },
    population: 374260,
    isFeatured: false,
    order: 9
  },
  {
    name: { te: 'వరంగల్', en: 'Warangal', hi: 'वारंगल' },
    state: { te: 'తెలంగాణ', en: 'Telangana', hi: 'तेलंगाना' },
    center: { type: 'Point', coordinates: [79.5941, 17.9784] },
    location: { type: 'Point', coordinates: [79.5941, 17.9784] },
    population: 811844,
    isFeatured: false,
    order: 10
  }
];

// Sample areas for Hyderabad
const hyderabadAreas = [
  { name: { te: 'బంజారా హిల్స్', en: 'Banjara Hills', hi: 'बंजारा हिल्स' }, center: [78.4445, 17.4156], pincode: '500034' },
  { name: { te: 'హైటెక్ సిటీ', en: 'HITEC City', hi: 'हाईटेक सिटी' }, center: [78.3772, 17.4435], pincode: '500081' },
  { name: { te: 'గచ్చిబౌలి', en: 'Gachibowli', hi: 'गच्चीबोवली' }, center: [78.3498, 17.4401], pincode: '500032' },
  { name: { te: 'సికింద్రాబాద్', en: 'Secunderabad', hi: 'सिकंदराबाद' }, center: [78.4983, 17.4399], pincode: '500003' },
  { name: { te: 'జూబిలీ హిల్స్', en: 'Jubilee Hills', hi: 'जुबली हिल्स' }, center: [78.4067, 17.4325], pincode: '500033' }
];

// Sample areas for Vijayawada
const vijayawadaAreas = [
  { name: { te: 'మొగల్రాజపురం', en: 'Mogalrajapuram', hi: 'मोगलराजपुरम' }, center: [80.6280, 16.5120], pincode: '520010' },
  { name: { te: 'గవర్నర్‌పేట', en: 'Governorpet', hi: 'गवर्नरपेट' }, center: [80.6220, 16.5180], pincode: '520002' },
  { name: { te: 'లబ్బీపేట', en: 'Labbipet', hi: 'लब्बीपेट' }, center: [80.6380, 16.5040], pincode: '520010' }
];

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data (optional - remove in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Clearing existing data...');
      await Promise.all([
        User.deleteMany({}),
        Category.deleteMany({}),
        City.deleteMany({}),
        Area.deleteMany({}),
        Article.deleteMany({}),
        Language.deleteMany({})
      ]);
    }

    // Create default languages
    console.log('Creating languages...');
    const teluguLang = await Language.create({
      code: 'te',
      name: 'Telugu',
      nativeName: 'తెలుగు',
      isDefault: true,
      isActive: true,
      isRTL: false,
      order: 1
    });
    const englishLang = await Language.create({
      code: 'en',
      name: 'English',
      nativeName: 'English',
      isDefault: false,
      isActive: true,
      isRTL: false,
      order: 2
    });
    const hindiLang = await Language.create({
      code: 'hi',
      name: 'Hindi',
      nativeName: 'हिन्दी',
      isDefault: false,
      isActive: true,
      isRTL: false,
      order: 3
    });
    console.log('✅ Created languages: Telugu (default), English, Hindi');

    // Initialize language cache
    const languageCache = require('../utils/languageCache');
    await languageCache.refreshCache();

    // Create admin user (password will be hashed by the model's pre-save hook)
    console.log('Creating admin user...');
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@taajanews.com',
      password: 'admin123', // Plain password - model will hash it
      role: 'admin',
      isActive: true
    });
    console.log(`✅ Admin created: ${admin.email}`);

    // Create reporter user (password will be hashed by the model's pre-save hook)
    const reporter = await User.create({
      name: 'Reporter User',
      email: 'reporter@taajanews.com',
      password: 'reporter123', // Plain password - model will hash it
      role: 'reporter',
      isActive: true,
      bio: 'Senior reporter at Taaja News'
    });
    console.log(`✅ Reporter created: ${reporter.email}`);

    // Create categories (using save to trigger pre-save hooks for slug generation)
    console.log('Creating categories...');
    const createdCategories = [];
    for (const categoryData of categories) {
      const category = new Category({
        ...categoryData,
        name: toMap(categoryData.name),
        description: toMap(categoryData.description || {})
      });
      await category.save();
      createdCategories.push(category);
    }
    console.log(`✅ Created ${createdCategories.length} categories`);

    // Create sub-categories for Politics
    const politicsCategory = createdCategories.find(c => c.name.get('en') === 'Politics');
    const politicsSubcategories = [
      { name: { te: 'జాతీయం', en: 'National', hi: 'राष्ट्रीय' }, parent: politicsCategory._id, order: 1 },
      { name: { te: 'రాష్ట్రం', en: 'State', hi: 'राज्य' }, parent: politicsCategory._id, order: 2 },
      { name: { te: 'అంతర్జాతీయం', en: 'International', hi: 'अंतर्राष्ट्रीय' }, parent: politicsCategory._id, order: 3 }
    ];
    for (const subCat of politicsSubcategories) {
      const category = new Category({
        ...subCat,
        name: toMap(subCat.name)
      });
      await category.save();
    }
    console.log('✅ Created politics subcategories');

    // Create sub-categories for Sports
    const sportsCategory = createdCategories.find(c => c.name.get('en') === 'Sports');
    const sportsSubcategories = [
      { name: { te: 'క్రికెట్', en: 'Cricket', hi: 'क्रिकेट' }, parent: sportsCategory._id, order: 1 },
      { name: { te: 'ఫుట్‌బాల్', en: 'Football', hi: 'फुटबॉल' }, parent: sportsCategory._id, order: 2 },
      { name: { te: 'టెన్నిస్', en: 'Tennis', hi: 'टेनिस' }, parent: sportsCategory._id, order: 3 },
      { name: { te: 'ఒలింపిక్స్', en: 'Olympics', hi: 'ओलंपिक' }, parent: sportsCategory._id, order: 4 }
    ];
    for (const subCat of sportsSubcategories) {
      const category = new Category({
        ...subCat,
        name: toMap(subCat.name)
      });
      await category.save();
    }
    console.log('✅ Created sports subcategories');

    // Create cities (using save to trigger pre-save hooks for slug generation)
    console.log('Creating cities...');
    const createdCities = [];
    for (const cityData of cities) {
      const city = new City({
        ...cityData,
        name: toMap(cityData.name),
        state: toMap(cityData.state)
      });
      await city.save();
      createdCities.push(city);
    }
    console.log(`✅ Created ${createdCities.length} cities`);

    // Create areas for Hyderabad and Vijayawada
    const hyderabad = createdCities.find(c => c.name.get('en') === 'Hyderabad');
    const vijayawada = createdCities.find(c => c.name.get('en') === 'Vijayawada');

    const hyderabadAreaDocs = hyderabadAreas.map((area, index) => {
      const doc = {
        name: toMap(area.name),
        pincode: area.pincode,
        city: hyderabad._id,
        center: { type: 'Point', coordinates: area.center },
        order: index + 1,
        isFeatured: index < 3
      };
      return doc;
    });

    const vijayawadaAreaDocs = vijayawadaAreas.map((area, index) => {
      const doc = {
        name: toMap(area.name),
        pincode: area.pincode,
        city: vijayawada._id,
        center: { type: 'Point', coordinates: area.center },
        order: index + 1,
        isFeatured: index < 2
      };
      return doc;
    });

    const allAreas = [...hyderabadAreaDocs, ...vijayawadaAreaDocs];
    for (const areaData of allAreas) {
      const area = new Area(areaData);
      await area.save();
    }
    console.log('✅ Created areas for Hyderabad and Vijayawada');

    // Create sample articles
    console.log('Creating sample articles...');
    const localNewsCategory = createdCategories.find(c => c.name.get('en') === 'Local News');
    const techCategory = createdCategories.find(c => c.name.get('en') === 'Technology');
    const entertainmentCategory = createdCategories.find(c => c.name.get('en') === 'Entertainment');
    const businessCategory = createdCategories.find(c => c.name.get('en') === 'Business');
    // sportsCategory already defined above for subcategories

    // Get areas for linking to articles
    const createdAreas = await Area.find({});
    const hitecCityArea = createdAreas.find(a => a.name.get('en') === 'HITEC City');
    const gachibowliArea = createdAreas.find(a => a.name.get('en') === 'Gachibowli');
    const banjaraHillsArea = createdAreas.find(a => a.name.get('en') === 'Banjara Hills');
    const jubileeHillsArea = createdAreas.find(a => a.name.get('en') === 'Jubilee Hills');
    const mogalrajapuramArea = createdAreas.find(a => a.name.get('en') === 'Mogalrajapuram');

    const sampleArticles = [
      {
        title: {
          te: 'హైటెక్ సిటీలో కొత్త మెట్రో లైన్ ప్రారంభం - రాజీవ్ గాంధీ విమానాశ్రయానికి కనెక్షన్',
          en: 'New Metro Line Opens in HITEC City - Connecting to Rajiv Gandhi Airport',
          hi: 'हाईटेक सिटी में नई मेट्रो लाइन शुरू - राजीव गांधी एयरपोर्ट से कनेक्शन'
        },
        summary: {
          te: 'హైదరాబాద్ మెట్రో రైల్ కొత్త లైన్ ప్రారంభించబడింది, ప్రయాణ సమయం గణనీయంగా తగ్గింది.',
          en: 'Hyderabad Metro Rail inaugurates new line, significantly reducing travel time.',
          hi: 'हैदराबाद मेट्रो रेल ने नई लाइन का उद्घाटन किया, यात्रा समय काफी कम हो गया।'
        },
        content: {
          te: 'హైదరాబాద్ మెట్రో రైల్ లిమిటెడ్ (HMRL) హైటెక్ సిటీని రాజీవ్ గాంధీ అంతర్జాతీయ విమానాశ్రయానికి అనుసంధానం చేసే కొత్త మెట్రో లైన్‌ను ప్రారంభించింది. 15 కిలోమీటర్ల పొడవైన ఈ మార్గంలో 10 స్టేషన్లు ఉన్నాయి మరియు రోజువారీ 3 లక్షల మంది ప్రయాణికులను నిర్వహించగలదు.\n\nఈ కొత్త లైన్ హైటెక్ సిటీ నుండి విమానాశ్రయానికి ప్రయాణ సమయాన్ని 60 నిమిషాల నుండి కేవలం 25 నిమిషాలకు తగ్గిస్తుంది. IT ఉద్యోగులు మరియు తరచుగా ప్రయాణించే వారికి ఇది పెద్ద సహాయం.',
          en: 'Hyderabad Metro Rail Limited (HMRL) has inaugurated a new metro line connecting HITEC City to Rajiv Gandhi International Airport. This 15-kilometer stretch features 10 stations and can handle over 300,000 passengers daily.\n\nThe new line will reduce travel time from HITEC City to the airport from 60 minutes to just 25 minutes. This is a major relief for IT employees and frequent travelers.',
          hi: 'हैदराबाद मेट्रो रेल लिमिटेड (HMRL) ने हाईटेक सिटी को राजीव गांधी अंतर्राष्ट्रीय हवाई अड्डे से जोड़ने वाली नई मेट्रो लाइन का उद्घाटन किया है।'
        },
        author: reporter._id,
        category: localNewsCategory._id,
        city: hyderabad._id,
        area: hitecCityArea?._id,
        location: { type: 'Point', coordinates: [78.3772, 17.4435] },
        status: 'published',
        publishedAt: new Date(),
        tags: ['metro', 'hyderabad', 'hitec-city', 'transportation'],
        isFeatured: true,
        featuredImage: {
          url: 'https://picsum.photos/seed/metro1/800/450',
          caption: { te: 'హైదరాబాద్ మెట్రో ట్రైన్', en: 'Hyderabad Metro Train', hi: 'हैदराबाद मेट्रो ट्रेन' },
          alt: 'Metro train in Hyderabad'
        }
      },
      {
        title: {
          te: 'గచ్చిబౌలిలో భారీ IT క్యాంపస్ ప్రారంభం - 50,000 ఉద్యోగాలు',
          en: 'Major IT Campus Inaugurated in Gachibowli - 50,000 Jobs',
          hi: 'गच्चीबोवली में बड़े IT कैंपस का उद्घाटन - 50,000 नौकरियां'
        },
        summary: {
          te: 'ప్రముఖ టెక్ కంపెనీ గచ్చిబౌలిలో తన అతిపెద్ద క్యాంపస్‌ను ప్రారంభించింది.',
          en: 'Leading tech company launches its largest campus in Gachibowli.',
          hi: 'प्रमुख टेक कंपनी ने गच्चीबोवली में अपना सबसे बड़ा कैंपस लॉन्च किया।'
        },
        content: {
          te: 'ప్రపంచ ప్రసిద్ధ టెక్నాలజీ కంపెనీ గచ్చిబౌలిలో తన అతిపెద్ద భారతీయ క్యాంపస్‌ను ప్రారంభించింది. 50 ఎకరాల్లో విస్తరించిన ఈ క్యాంపస్ 50,000 మందికి ఉద్యోగావకాశాలు కల్పిస్తుంది.\n\nఈ క్యాంపస్‌లో అత్యాధునిక పరిశోధన కేంద్రాలు, ఇన్నోవేషన్ ల్యాబ్‌లు మరియు సస్టెయినబుల్ బిల్డింగ్‌లు ఉన్నాయి. తెలంగాణ ప్రభుత్వం ఈ ప్రాజెక్ట్‌కు పూర్తి మద్దతు అందించింది.',
          en: 'A world-renowned technology company has inaugurated its largest Indian campus in Gachibowli. Spread over 50 acres, this campus will provide employment opportunities for 50,000 people.\n\nThe campus features state-of-the-art research centers, innovation labs, and sustainable buildings.',
          hi: 'एक विश्व प्रसिद्ध टेक्नोलॉजी कंपनी ने गच्चीबोवली में अपना सबसे बड़ा भारतीय कैंपस शुरू किया है।'
        },
        author: reporter._id,
        category: techCategory._id,
        city: hyderabad._id,
        area: gachibowliArea?._id,
        location: { type: 'Point', coordinates: [78.3498, 17.4401] },
        status: 'published',
        publishedAt: new Date(Date.now() - 3600000),
        tags: ['technology', 'jobs', 'hyderabad', 'gachibowli', 'IT'],
        isFeatured: true,
        featuredImage: {
          url: 'https://picsum.photos/seed/itcampus/800/450',
          caption: { te: 'కొత్త IT క్యాంపస్', en: 'New IT Campus', hi: 'नया IT कैंपस' },
          alt: 'Modern IT campus building'
        }
      },
      {
        title: {
          te: 'తెలుగు సినిమా "ఆనందం" బాక్సాఫీస్ వద్ద రికార్డులు బద్దలు',
          en: 'Telugu Film "Anandam" Breaks Box Office Records',
          hi: 'तेलुगु फिल्म "आनंदम" ने बॉक्स ऑफिस रिकॉर्ड तोड़े'
        },
        summary: {
          te: 'కొత్త తెలుగు సినిమా మొదటి వారంలో ₹500 కోట్లు వసూలు చేసింది.',
          en: 'New Telugu film collects ₹500 crores in its first week.',
          hi: 'नई तेलुगु फिल्म ने पहले हफ्ते में ₹500 करोड़ कमाए।'
        },
        content: {
          te: 'టాలీవుడ్ స్టార్ హీరో నటించిన "ఆనందం" సినిమా బాక్సాఫీస్ వద్ద సంచలనం సృష్టిస్తోంది. మొదటి వారంలోనే ₹500 కోట్లు వసూలు చేసి రికార్డులు బద్దలు కొట్టింది.\n\nఈ సినిమా ప్రపంచవ్యాప్తంగా 5,000 కు పైగా స్క్రీన్లలో విడుదలైంది. ప్రేక్షకులు మరియు విమర్శకులు ఒకే విధంగా ప్రశంసించారు. దర్శకుడి స్టోరీటెల్లింగ్ మరియు హీరో నటన హైలైట్లుగా నిలిచాయి.',
          en: 'The Tollywood star-led film "Anandam" is creating a sensation at the box office. It collected ₹500 crores in its first week, breaking all records.\n\nThe film was released on over 5,000 screens worldwide. Both audiences and critics have praised it alike.',
          hi: 'टॉलीवुड स्टार की फिल्म "आनंदम" बॉक्स ऑफिस पर धूम मचा रही है।'
        },
        author: reporter._id,
        category: entertainmentCategory._id,
        city: hyderabad._id,
        area: jubileeHillsArea?._id,
        location: { type: 'Point', coordinates: [78.4067, 17.4325] },
        status: 'published',
        publishedAt: new Date(Date.now() - 7200000),
        tags: ['tollywood', 'cinema', 'entertainment', 'box-office'],
        isFeatured: true,
        featuredImage: {
          url: 'https://picsum.photos/seed/cinema1/800/450',
          caption: { te: 'సినిమా పోస్టర్', en: 'Movie Poster', hi: 'फिल्म पोस्टर' },
          alt: 'Telugu movie promotional image'
        }
      },
      {
        title: {
          te: 'SRH vs CSK: IPL 2026 - హైదరాబాద్‌లో థ్రిల్లింగ్ మ్యాచ్',
          en: 'SRH vs CSK: IPL 2026 - Thrilling Match in Hyderabad',
          hi: 'SRH vs CSK: IPL 2026 - हैदराबाद में रोमांचक मैच'
        },
        summary: {
          te: 'సన్‌రైజర్స్ హైదరాబాద్ చివరి బంతిలో సీఎస్‌కేపై విజయం సాధించింది.',
          en: 'Sunrisers Hyderabad defeats CSK off the last ball.',
          hi: 'सनराइजर्स हैदराबाद ने आखिरी गेंद पर CSK को हराया।'
        },
        content: {
          te: 'రాజీవ్ గాంధీ అంతర్జాతీయ క్రీడా మైదానంలో జరిగిన IPL 2026 మ్యాచ్‌లో సన్‌రైజర్స్ హైదరాబాద్ (SRH) చెన్నై సూపర్ కింగ్స్ (CSK) పై చివరి బంతిలో సంచలన విజయం సాధించింది.\n\n50,000 మంది అభిమానులు నిండిన స్టేడియంలో హోమ్ టీమ్ అద్భుతమైన ప్రదర్శనతో అందరినీ ఆకట్టుకుంది. SRH ఓపెనర్ సెంచరీ చేసి మ్యాన్ ఆఫ్ ది మ్యాచ్ అవార్డు గెలుచుకున్నాడు.',
          en: 'In the IPL 2026 match at Rajiv Gandhi International Cricket Stadium, Sunrisers Hyderabad (SRH) achieved a sensational victory over Chennai Super Kings (CSK) off the last ball.\n\nIn a stadium packed with 50,000 fans, the home team impressed everyone with their brilliant performance.',
          hi: 'IPL 2026 मैच में सनराइजर्स हैदराबाद ने आखिरी गेंद पर CSK को हराया।'
        },
        author: reporter._id,
        category: sportsCategory._id,
        city: hyderabad._id,
        location: { type: 'Point', coordinates: [78.4867, 17.3850] },
        status: 'published',
        publishedAt: new Date(Date.now() - 14400000),
        tags: ['cricket', 'IPL', 'SRH', 'sports', 'hyderabad'],
        isBreaking: true,
        featuredImage: {
          url: 'https://picsum.photos/seed/cricket1/800/450',
          caption: { te: 'IPL మ్యాచ్', en: 'IPL Match', hi: 'IPL मैच' },
          alt: 'Cricket match at stadium'
        }
      },
      {
        title: {
          te: 'విజయవాడ కానర చెరువు అభివృద్ధి - ₹200 కోట్ల ప్రాజెక్ట్',
          en: 'Vijayawada Kanaka Durga Temple Lake Development - ₹200 Crore Project',
          hi: 'विजयवाड़ा कनक दुर्गा मंदिर झील विकास - ₹200 करोड़ का प्रोजेक्ट'
        },
        summary: {
          te: 'ఆంధ్ర ప్రదేశ్ ప్రభుత్వం విజయవాడలో భారీ అభివృద్ధి ప్రాజెక్ట్ ప్రారంభించింది.',
          en: 'Andhra Pradesh government launches major development project in Vijayawada.',
          hi: 'आंध्र प्रदेश सरकार ने विजयवाड़ा में बड़े विकास प्रोजेक्ट की शुरुआत की।'
        },
        content: {
          te: 'ఆంధ్ర ప్రదేశ్ ప్రభుత్వం విజయవాడలోని కనక దుర్గ ఆలయ ప్రాంతంలో ₹200 కోట్ల అభివృద్ధి ప్రాజెక్ట్‌ను ప్రారంభించింది. ఈ ప్రాజెక్ట్‌లో చెరువు అందగించడం, వాకింగ్ ట్రాక్‌లు, గార్డెన్లు మరియు పర్యాటక సౌకర్యాలు ఉన్నాయి.\n\nముఖ్యమంత్రి ఈ ప్రాజెక్ట్‌ను శంకుస్థాపన చేశారు. 18 నెలల్లో పూర్తి చేయాలని లక్ష్యం. స్థానికులు మరియు పర్యాటకులకు ఇది పెద్ద ఆకర్షణగా మారనుంది.',
          en: 'The Andhra Pradesh government has launched a ₹200 crore development project in the Kanaka Durga temple area of Vijayawada. The project includes lake beautification, walking tracks, gardens, and tourist facilities.\n\nThe Chief Minister laid the foundation stone for this project. The target is to complete it in 18 months.',
          hi: 'आंध्र प्रदेश सरकार ने विजयवाड़ा में ₹200 करोड़ का विकास प्रोजेक्ट शुरू किया है।'
        },
        author: reporter._id,
        category: localNewsCategory._id,
        city: vijayawada._id,
        area: mogalrajapuramArea?._id,
        location: { type: 'Point', coordinates: [80.6280, 16.5120] },
        status: 'published',
        publishedAt: new Date(Date.now() - 86400000),
        tags: ['vijayawada', 'development', 'tourism', 'andhra-pradesh'],
        isFeatured: false,
        featuredImage: {
          url: 'https://picsum.photos/seed/temple1/800/450',
          caption: { te: 'కనక దుర్గ ఆలయం', en: 'Kanaka Durga Temple', hi: 'कनक दुर्गा मंदिर' },
          alt: 'Vijayawada temple area'
        }
      },
      {
        title: {
          te: 'హైదరాబాద్ స్టార్టప్‌లకు ₹1000 కోట్ల ఫండింగ్',
          en: 'Hyderabad Startups Receive ₹1000 Crore Funding',
          hi: 'हैदराबाद स्टार्टअप्स को ₹1000 करोड़ की फंडिंग'
        },
        summary: {
          te: 'తెలంగాణ స్టార్టప్ ఎకోసిస్టమ్ వేగంగా అభివృద్ధి చెందుతోంది.',
          en: 'Telangana startup ecosystem is rapidly growing.',
          hi: 'तेलंगाना स्टार्टअप इकोसिस्टम तेजी से बढ़ रहा है।'
        },
        content: {
          te: 'హైదరాబాద్ ఆధారిత స్టార్టప్‌లు ఈ త్రైమాసికంలో ₹1000 కోట్లకు పైగా ఫండింగ్ సమీకరించాయి. ఫిన్‌టెక్, హెల్త్‌టెక్ మరియు AI రంగాలలో పెట్టుబడులు ఎక్కువగా వచ్చాయి.\n\nT-Hub మరియు TASK వంటి ప్రభుత్వ సంస్థలు స్టార్టప్‌లకు అవసరమైన మద్దతు అందిస్తున్నాయి. హైదరాబాద్ దేశంలోనే నాలుగో అతిపెద్ద స్టార్టప్ హబ్‌గా ఎదిగింది.',
          en: 'Hyderabad-based startups have raised over ₹1000 crores in funding this quarter. Investments have come mainly in fintech, healthtech, and AI sectors.\n\nGovernment organizations like T-Hub and TASK are providing necessary support to startups. Hyderabad has emerged as the fourth largest startup hub in the country.',
          hi: 'हैदराबाद स्टार्टअप्स ने इस तिमाही में ₹1000 करोड़ से अधिक की फंडिंग जुटाई है।'
        },
        author: reporter._id,
        category: businessCategory._id,
        city: hyderabad._id,
        area: hitecCityArea?._id,
        location: { type: 'Point', coordinates: [78.3772, 17.4435] },
        status: 'published',
        publishedAt: new Date(Date.now() - 172800000),
        tags: ['startup', 'funding', 'business', 'hyderabad', 'telangana'],
        isFeatured: true,
        featuredImage: {
          url: 'https://picsum.photos/seed/startup1/800/450',
          caption: { te: 'స్టార్టప్ ఆఫీస్', en: 'Startup Office', hi: 'स्टार्टअप ऑफिस' },
          alt: 'Modern startup office'
        }
      },
      {
        title: {
          te: 'బంజారా హిల్స్‌లో కొత్త ఫుడ్ ఫెస్టివల్ - 100 రకాల వంటకాలు',
          en: 'New Food Festival in Banjara Hills - 100 Varieties of Cuisine',
          hi: 'बंजारा हिल्स में नया फूड फेस्टिवल - 100 तरह के व्यंजन'
        },
        summary: {
          te: 'వారాంతపు ఫుడ్ ఫెస్టివల్ భారీ జనసమూహాన్ని ఆకర్షిస్తోంది.',
          en: 'Weekend food festival attracts massive crowds.',
          hi: 'वीकेंड फूड फेस्टिवल में भारी भीड़ उमड़ी।'
        },
        content: {
          te: 'బంజారా హిల్స్‌లో జరుగుతున్న వార్షిక ఫుడ్ ఫెస్టివల్ వేల మంది ఫుడ్ ప్రేమికులను ఆకర్షిస్తోంది. 100 కు పైగా స్టాల్స్‌లో తెలుగు, ఉత్తర భారత, దక్షిణ భారత మరియు అంతర్జాతీయ వంటకాలు అందుబాటులో ఉన్నాయి.\n\nలైవ్ మ్యూజిక్, కుకింగ్ డెమోన్‌స్ట్రేషన్లు మరియు కిడ్స్ జోన్ కూడా ఏర్పాటు చేశారు. ఆదివారం సాయంత్రం వరకు ఫెస్టివల్ కొనసాగుతుంది.',
          en: 'The annual food festival in Banjara Hills is attracting thousands of food lovers. Over 100 stalls offer Telugu, North Indian, South Indian, and international cuisines.\n\nLive music, cooking demonstrations, and a kids zone have also been arranged. The festival continues until Sunday evening.',
          hi: 'बंजारा हिल्स में वार्षिक फूड फेस्टिवल हजारों फूड लवर्स को आकर्षित कर रहा है।'
        },
        author: reporter._id,
        category: localNewsCategory._id,
        city: hyderabad._id,
        area: banjaraHillsArea?._id,
        location: { type: 'Point', coordinates: [78.4445, 17.4156] },
        status: 'published',
        publishedAt: new Date(Date.now() - 28800000),
        tags: ['food', 'festival', 'hyderabad', 'banjara-hills'],
        isFeatured: false,
        featuredImage: {
          url: 'https://picsum.photos/seed/food1/800/450',
          caption: { te: 'ఫుడ్ ఫెస్టివల్', en: 'Food Festival', hi: 'फूड फेस्टिवल' },
          alt: 'Food festival stalls'
        }
      }
    ];

    for (const articleData of sampleArticles) {
      const articleDoc = {
        ...articleData,
        title: toMap(articleData.title),
        summary: toMap(articleData.summary),
        content: toMap(articleData.content)
      };
      // Convert featuredImage caption if present
      if (articleData.featuredImage?.caption) {
        articleDoc.featuredImage = {
          ...articleData.featuredImage,
          caption: toMap(articleData.featuredImage.caption)
        };
      }
      const article = new Article(articleDoc);
      await article.save();
    }
    console.log('✅ Created sample articles with images');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('   Admin: admin@taajanews.com / admin123');
    console.log('   Reporter: reporter@taajanews.com / reporter123');

  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  }
};

module.exports = { seedDatabase };

// Run seeding (only when invoked directly, e.g. `npm run seed` — not when
// required as a module by config/db.js's in-memory-Mongo fallback)
if (require.main === module) {
  const runSeed = async () => {
    await connectDB();
    await seedDatabase();
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  };

  runSeed().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
