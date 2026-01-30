import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const LocationContext = createContext(null);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export const LocationProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [city, setCity] = useState(null);
  const [area, setArea] = useState(null);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coordinates, setCoordinates] = useState(null);

  // Load saved location from localStorage
  useEffect(() => {
    const savedCity = localStorage.getItem('taaja_city');
    const savedArea = localStorage.getItem('taaja_area');
    
    if (savedCity) {
      try {
        setCity(JSON.parse(savedCity));
      } catch (e) {
        localStorage.removeItem('taaja_city');
      }
    }
    
    if (savedArea) {
      try {
        setArea(JSON.parse(savedArea));
      } catch (e) {
        localStorage.removeItem('taaja_area');
      }
    }
    
    setLoading(false);
  }, []);

  // Fetch cities with language parameter
  const fetchCities = useCallback(async () => {
    try {
      const lang = i18n.language || 'te';
      const response = await api.get(`/locations/cities?lang=${lang}`);
      setCities(response.data.cities || []);
      return response.data.cities || [];
    } catch (err) {
      console.error('Failed to fetch cities:', err);
      return [];
    }
  }, [i18n.language]);

  // Fetch areas for a city with language parameter
  const fetchAreas = useCallback(async (cityId) => {
    try {
      const lang = i18n.language || 'te';
      const response = await api.get(`/locations/areas?city=${cityId}&lang=${lang}`);
      setAreas(response.data.areas || []);
      return response.data.areas || [];
    } catch (err) {
      console.error('Failed to fetch areas:', err);
      return [];
    }
  }, [i18n.language]);

  // Select city
  const selectCity = useCallback((selectedCity) => {
    setCity(selectedCity);
    setArea(null); // Reset area when city changes
    setAreas([]);
    
    if (selectedCity) {
      localStorage.setItem('taaja_city', JSON.stringify(selectedCity));
      localStorage.removeItem('taaja_area');
      fetchAreas(selectedCity._id);
    } else {
      localStorage.removeItem('taaja_city');
      localStorage.removeItem('taaja_area');
    }
  }, [fetchAreas]);

  // Select area
  const selectArea = useCallback((selectedArea) => {
    setArea(selectedArea);
    
    if (selectedArea) {
      localStorage.setItem('taaja_area', JSON.stringify(selectedArea));
    } else {
      localStorage.removeItem('taaja_area');
    }
  }, []);

  // Detect location using browser geolocation
  const detectLocation = useCallback(async () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { longitude, latitude } = position.coords;
          setCoordinates({ lng: longitude, lat: latitude });

          try {
            // Find nearby cities
            const cityResponse = await api.get('/locations/cities/nearby', {
              params: { lng: longitude, lat: latitude, limit: 1 }
            });

            if (cityResponse.data.cities.length > 0) {
              const nearestCity = cityResponse.data.cities[0];
              selectCity(nearestCity);

              // Find nearby areas
              const areaResponse = await api.get('/locations/areas/nearby', {
                params: { lng: longitude, lat: latitude, limit: 1 }
              });

              if (areaResponse.data.areas.length > 0) {
                selectArea(areaResponse.data.areas[0]);
              }

              resolve({ city: nearestCity, area: areaResponse.data.areas[0] });
            } else {
              reject(new Error('No nearby cities found'));
            }
          } catch (err) {
            reject(err);
          }
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // Cache for 5 minutes
        }
      );
    });
  }, [selectCity, selectArea]);

  // Clear location
  const clearLocation = useCallback(() => {
    setCity(null);
    setArea(null);
    setAreas([]);
    setCoordinates(null);
    localStorage.removeItem('taaja_city');
    localStorage.removeItem('taaja_area');
  }, []);

  // Check if onboarding is complete
  const isOnboardingComplete = !!city;

  const value = {
    city,
    area,
    cities,
    areas,
    loading,
    coordinates,
    isOnboardingComplete,
    fetchCities,
    fetchAreas,
    selectCity,
    selectArea,
    detectLocation,
    clearLocation
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};
