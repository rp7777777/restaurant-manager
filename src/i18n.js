import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './Locales/en.json'
import pt from './Locales/pt.json'

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: en,
    },
    pt: {
      translation: pt,
    },
  },
  lng: 'en',
  fallbackLng: 'en',

  interpolation: {
    escapeValue: false,
  },
})

export default i18n