// Backend Currency Configuration
// This should match the frontend configuration in client/src/config/currency.js

const CURRENCY_CONFIG = {
  // ========================================
  // DEVELOPER: CHANGE THESE VALUES TO SWITCH CURRENCY
  // ========================================
  
  // Currency Code (ISO 4217)
  code: 'INR', // Options: 'INR', 'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', etc.
  
  // Currency Symbol
  symbol: '₹', // Options: '₹', '$', '€', '£', 'د.إ', 'C$', 'A$', etc.
  
  // Locale for number formatting
  locale: 'en-IN', // Options: 'en-IN', 'en-US', 'de-DE', 'en-GB', 'en-AE', etc.
  
  // Number formatting options
  numberFormat: {
    style: 'currency',
    currency: 'INR', // This should match the code above
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }
}

// Price formatting function using Intl.NumberFormat
const formatPrice = (price) => {
  if (!price || price === 0) {
    return new Intl.NumberFormat(CURRENCY_CONFIG.locale, CURRENCY_CONFIG.numberFormat).format(0)
  }
  
  return new Intl.NumberFormat(CURRENCY_CONFIG.locale, CURRENCY_CONFIG.numberFormat).format(price)
}

// Get currency symbol
const getCurrencySymbol = () => {
  return CURRENCY_CONFIG.symbol
}

// Get currency code
const getCurrencyCode = () => {
  return CURRENCY_CONFIG.code
}

// Get locale
const getLocale = () => {
  return CURRENCY_CONFIG.locale
}

// Get current currency info
const getCurrentCurrency = () => {
  return {
    code: CURRENCY_CONFIG.code,
    symbol: CURRENCY_CONFIG.symbol,
    locale: CURRENCY_CONFIG.locale
  }
}

// Utility function to change currency (for runtime switching if needed)
const changeCurrency = (newCurrency) => {
  const currencyMap = {
    'INR': { symbol: '₹', locale: 'en-IN', code: 'INR' },
    'USD': { symbol: '$', locale: 'en-US', code: 'USD' },
    'EUR': { symbol: '€', locale: 'de-DE', code: 'EUR' },
    'GBP': { symbol: '£', locale: 'en-GB', code: 'GBP' },
    'AED': { symbol: 'د.إ', locale: 'en-AE', code: 'AED' },
    'CAD': { symbol: 'C$', locale: 'en-CA', code: 'CAD' },
    'AUD': { symbol: 'A$', locale: 'en-AU', code: 'AUD' }
  }
  
  if (currencyMap[newCurrency]) {
    CURRENCY_CONFIG.code = newCurrency
    CURRENCY_CONFIG.symbol = currencyMap[newCurrency].symbol
    CURRENCY_CONFIG.locale = currencyMap[newCurrency].locale
    CURRENCY_CONFIG.numberFormat.currency = newCurrency
    
    return true
  }
  
  return false
}

export {
  CURRENCY_CONFIG,
  formatPrice,
  getCurrencySymbol,
  getCurrencyCode,
  getLocale,
  getCurrentCurrency,
  changeCurrency
}
