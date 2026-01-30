import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Cookies from 'js-cookie';

const resources = {
  te: {
    translation: {
      // App
      appName: 'తాజా న్యూస్',
      tagline: 'తాజా వార్తలు, తాజాగా డెలివరీ',
      
      // Navigation
      home: 'హోమ్',
      categories: 'వర్గాలు',
      search: 'వెతకండి',
      profile: 'ప్రొఫైల్',
      settings: 'సెట్టింగ్‌లు',
      
      // Onboarding
      selectLanguage: 'భాష ఎంచుకోండి',
      selectCity: 'మీ నగరం ఎంచుకోండి',
      selectArea: 'మీ ప్రాంతం ఎంచుకోండి',
      continue: 'కొనసాగించండి',
      skip: 'దాటవేయండి',
      getStarted: 'ప్రారంభించండి',
      back: 'వెనుకకు',
      welcome: 'తాజా న్యూస్‌కు స్వాగతం',
      welcomeDesc: 'ఆకర్షణీయమైన రీడింగ్ అనుభవంలో మీ స్థానిక వార్తలను పొందండి',
      popularCities: 'ప్రసిద్ధ నగరాలు',
      
      // Auth
      login: 'లాగిన్',
      logout: 'లాగౌట్',
      register: 'రిజిస్టర్',
      email: 'ఇమెయిల్',
      password: 'పాస్‌వర్డ్',
      confirmPassword: 'పాస్‌వర్డ్ నిర్ధారించండి',
      name: 'పేరు',
      forgotPassword: 'పాస్‌వర్డ్ మర్చిపోయారా?',
      noAccount: 'ఖాతా లేదా?',
      hasAccount: 'ఇప్పటికే ఖాతా ఉందా?',
      
      // Articles
      latestNews: 'తాజా వార్తలు',
      breakingNews: 'బ్రేకింగ్ న్యూస్',
      trending: 'ట్రెండింగ్',
      featured: 'ఫీచర్డ్',
      readMore: 'ఇంకా చదవండి',
      relatedArticles: 'సంబంధిత వ్యాసాలు',
      publishedOn: 'ప్రచురించబడింది',
      by: 'రచన',
      minRead: 'నిమిషాల్లో చదవండి',
      views: 'వీక్షణలు',
      likes: 'లైక్‌లు',
      share: 'షేర్',
      bookmark: 'బుక్‌మార్క్',
      comments: 'వ్యాఖ్యలు',
      addComment: 'వ్యాఖ్య రాయండి',
      submitComment: 'సబ్మిట్',
      noComments: 'ఇంకా వ్యాఖ్యలు లేవు. మొదట వ్యాఖ్యానించండి!',
      
      // Categories
      politics: 'రాజకీయాలు',
      business: 'వ్యాపారం',
      sports: 'క్రీడలు',
      entertainment: 'వినోదం',
      technology: 'టెక్నాలజీ',
      health: 'ఆరోగ్యం',
      education: 'విద్య',
      localNews: 'స్థానిక వార్తలు',
      
      // Location
      nearYou: 'మీ సమీపంలో',
      changeLocation: 'స్థానం మార్చండి',
      detectLocation: 'నా స్థానం గుర్తించండి',
      
      // Dashboard
      dashboard: 'డాష్‌బోర్డ్',
      myArticles: 'నా వ్యాసాలు',
      createArticle: 'వ్యాసం సృష్టించండి',
      editArticle: 'వ్యాసం సవరించండి',
      manageCategories: 'వర్గాలు నిర్వహించండి',
      manageUsers: 'వినియోగదారులను నిర్వహించండి',
      analytics: 'అనలిటిక్స్',
      
      // Status
      published: 'ప్రచురించబడింది',
      draft: 'డ్రాఫ్ట్',
      pending: 'సమీక్షలో ఉంది',
      archived: 'ఆర్కైవ్ చేయబడింది',
      
      // Actions
      save: 'సేవ్',
      cancel: 'రద్దు చేయండి',
      delete: 'తొలగించండి',
      edit: 'సవరించండి',
      submit: 'సబ్మిట్',
      confirm: 'నిర్ధారించండి',
      
      // Messages
      loading: 'లోడ్ అవుతోంది...',
      error: 'ఏదో తప్పు జరిగింది',
      noResults: 'ఫలితాలు కనుగొనబడలేదు',
      success: 'విజయవంతం!',
      saved: 'విజయవంతంగా సేవ్ చేయబడింది',
      deleted: 'విజయవంతంగా తొలగించబడింది',
      
      // Flip reader
      flipInstruction: 'పేజీలు తిప్పడానికి స్వైప్ చేయండి లేదా క్లిక్ చేయండి',
      pageOf: 'పేజీ {{current}} / {{total}}'
    }
  },
  en: {
    translation: {
      // App
      appName: 'Taaja News',
      tagline: 'Fresh news, delivered fresh',
      
      // Navigation
      home: 'Home',
      categories: 'Categories',
      search: 'Search',
      profile: 'Profile',
      settings: 'Settings',
      
      // Onboarding
      selectLanguage: 'Select Language',
      selectCity: 'Select Your City',
      selectArea: 'Select Your Area',
      continue: 'Continue',
      skip: 'Skip',
      getStarted: 'Get Started',
      back: 'Back',
      welcome: 'Welcome to Taaja News',
      welcomeDesc: 'Get personalized local news delivered in an immersive reading experience',
      popularCities: 'Popular Cities',
      
      // Auth
      login: 'Login',
      logout: 'Logout',
      register: 'Register',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      name: 'Name',
      forgotPassword: 'Forgot Password?',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
      
      // Articles
      latestNews: 'Latest News',
      breakingNews: 'Breaking News',
      trending: 'Trending',
      featured: 'Featured',
      readMore: 'Read More',
      relatedArticles: 'Related Articles',
      publishedOn: 'Published on',
      by: 'By',
      minRead: 'min read',
      views: 'views',
      likes: 'likes',
      share: 'Share',
      bookmark: 'Bookmark',
      comments: 'Comments',
      addComment: 'Add a comment',
      submitComment: 'Submit',
      noComments: 'No comments yet. Be the first to comment!',
      
      // Categories
      politics: 'Politics',
      business: 'Business',
      sports: 'Sports',
      entertainment: 'Entertainment',
      technology: 'Technology',
      health: 'Health',
      education: 'Education',
      localNews: 'Local News',
      
      // Location
      nearYou: 'Near You',
      changeLocation: 'Change Location',
      detectLocation: 'Detect My Location',
      
      // Dashboard
      dashboard: 'Dashboard',
      myArticles: 'My Articles',
      createArticle: 'Create Article',
      editArticle: 'Edit Article',
      manageCategories: 'Manage Categories',
      manageUsers: 'Manage Users',
      analytics: 'Analytics',
      
      // Status
      published: 'Published',
      draft: 'Draft',
      pending: 'Pending Review',
      archived: 'Archived',
      
      // Actions
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      submit: 'Submit',
      confirm: 'Confirm',
      
      // Messages
      loading: 'Loading...',
      error: 'Something went wrong',
      noResults: 'No results found',
      success: 'Success!',
      saved: 'Saved successfully',
      deleted: 'Deleted successfully',
      
      // Flip reader
      flipInstruction: 'Swipe or click to turn pages',
      pageOf: 'Page {{current}} of {{total}}'
    }
  },
  hi: {
    translation: {
      // App
      appName: 'ताज़ा न्यूज़',
      tagline: 'ताज़ा खबर, ताज़ा डिलीवरी',
      
      // Navigation
      home: 'होम',
      categories: 'श्रेणियां',
      search: 'खोजें',
      profile: 'प्रोफाइल',
      settings: 'सेटिंग्स',
      
      // Onboarding
      selectLanguage: 'भाषा चुनें',
      selectCity: 'अपना शहर चुनें',
      selectArea: 'अपना क्षेत्र चुनें',
      continue: 'जारी रखें',
      skip: 'छोड़ें',
      getStarted: 'शुरू करें',
      back: 'वापस',
      welcome: 'ताज़ा न्यूज़ में आपका स्वागत है',
      welcomeDesc: 'एक immersive पढ़ने के अनुभव में व्यक्तिगत स्थानीय समाचार प्राप्त करें',
      popularCities: 'लोकप्रिय शहर',
      
      // Auth
      login: 'लॉगिन',
      logout: 'लॉगआउट',
      register: 'रजिस्टर करें',
      email: 'ईमेल',
      password: 'पासवर्ड',
      confirmPassword: 'पासवर्ड की पुष्टि करें',
      name: 'नाम',
      forgotPassword: 'पासवर्ड भूल गए?',
      noAccount: 'खाता नहीं है?',
      hasAccount: 'पहले से खाता है?',
      
      // Articles
      latestNews: 'ताज़ा खबर',
      breakingNews: 'ब्रेकिंग न्यूज़',
      trending: 'ट्रेंडिंग',
      featured: 'फीचर्ड',
      readMore: 'और पढ़ें',
      relatedArticles: 'संबंधित लेख',
      publishedOn: 'प्रकाशित',
      by: 'द्वारा',
      minRead: 'मिनट पढ़ें',
      views: 'व्यूज',
      likes: 'लाइक्स',
      share: 'शेयर',
      bookmark: 'बुकमार्क',
      comments: 'टिप्पणियां',
      addComment: 'टिप्पणी जोड़ें',
      submitComment: 'सबमिट करें',
      noComments: 'अभी तक कोई टिप्पणी नहीं। पहले टिप्पणी करें!',
      
      // Categories
      politics: 'राजनीति',
      business: 'व्यापार',
      sports: 'खेल',
      entertainment: 'मनोरंजन',
      technology: 'प्रौद्योगिकी',
      health: 'स्वास्थ्य',
      education: 'शिक्षा',
      localNews: 'स्थानीय समाचार',
      
      // Location
      nearYou: 'आपके पास',
      changeLocation: 'स्थान बदलें',
      detectLocation: 'मेरा स्थान पता करें',
      
      // Dashboard
      dashboard: 'डैशबोर्ड',
      myArticles: 'मेरे लेख',
      createArticle: 'लेख बनाएं',
      editArticle: 'लेख संपादित करें',
      manageCategories: 'श्रेणियां प्रबंधित करें',
      manageUsers: 'उपयोगकर्ता प्रबंधित करें',
      analytics: 'एनालिटिक्स',
      
      // Status
      published: 'प्रकाशित',
      draft: 'ड्राफ्ट',
      pending: 'समीक्षा में',
      archived: 'संग्रहीत',
      
      // Actions
      save: 'सेव करें',
      cancel: 'रद्द करें',
      delete: 'हटाएं',
      edit: 'संपादित करें',
      submit: 'सबमिट करें',
      confirm: 'पुष्टि करें',
      
      // Messages
      loading: 'लोड हो रहा है...',
      error: 'कुछ गलत हुआ',
      noResults: 'कोई परिणाम नहीं मिला',
      success: 'सफल!',
      saved: 'सफलतापूर्वक सेव हुआ',
      deleted: 'सफलतापूर्वक हटाया गया',
      
      // Flip reader
      flipInstruction: 'पेज बदलने के लिए स्वाइप करें या क्लिक करें',
      pageOf: 'पृष्ठ {{current}} में से {{total}}'
    }
  }
};

// Get saved language from cookie or default to 'te' (Telugu)
const savedLanguage = Cookies.get('taaja_lang') || 'te';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'te', // Telugu as fallback
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

// Save language preference to cookie when changed
i18n.on('languageChanged', (lng) => {
  Cookies.set('taaja_lang', lng, { expires: 365 });
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === 'ar' || lng === 'ur' ? 'rtl' : 'ltr';
});

export default i18n;
