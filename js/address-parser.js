// Address Parser - Extracts addresses from free text descriptions
// This is a FALLBACK when the "Address" custom field is not available

export class AddressParser {
  constructor() {
    // Regex patterns for different address formats
    this.patterns = [
      // US Format with street number: 123 Main St, City, ST 12345
      /\d{1,6}\s+[\w\s]{1,50}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|boulevard|blvd|circle|cir|place|pl|parkway|pkwy|highway|hwy)\b[.,]?\s*[\w\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/gi,

      // Format: Street, City, State ZIP
      /[\w\s]{5,50}[.,]\s*[\w\s]{3,30},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/gi,

      // Format with full state name: 123 Main St, City, California 12345
      /\d{1,6}\s+[\w\s]{1,50}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln)\b[.,]?\s*[\w\s]+,\s*(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\s+\d{5}(?:-\d{4})?/gi,

      // Simpler pattern: Any line with a 5-digit ZIP code
      /[\w\s,.-]{10,}?\d{5}(?:-\d{4})?/g
    ];

    // Keywords that often indicate an address follows
    this.addressKeywords = [
      'address:',
      'location:',
      'site:',
      'property:',
      'property address:',
      'site address:',
      'job site:',
      'shoot location:'
    ];
  }

  /**
   * Parse address from free text
   * @param {string} text - Text to parse (task description/notes)
   * @returns {string|null} Extracted address or null if not found
   */
  parse(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    // Try keyword-based extraction first (more accurate)
    const keywordAddress = this.extractByKeywords(text);
    if (keywordAddress) {
      return keywordAddress;
    }

    // Fallback to regex pattern matching
    const patternAddress = this.extractByPatterns(text);
    if (patternAddress) {
      return patternAddress;
    }

    return null;
  }

  /**
   * Extract address by looking for keyword indicators
   * @param {string} text - Text to search
   * @returns {string|null} Extracted address or null
   */
  extractByKeywords(text) {
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();

      // Check if line contains an address keyword
      for (const keyword of this.addressKeywords) {
        if (line.includes(keyword)) {
          // Extract address from current line (after keyword) and possibly next lines
          let address = this.extractFromLine(lines[i], keyword);

          // If address is incomplete, append next 1-2 lines
          if (address && address.length < 30 && i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine && nextLine.length > 0) {
              address += ', ' + nextLine;
            }
          }

          if (address && this.isValidAddress(address)) {
            return this.cleanAddress(address);
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract address from a single line after a keyword
   * @param {string} line - Line containing keyword
   * @param {string} keyword - Keyword found
   * @returns {string} Extracted address portion
   */
  extractFromLine(line, keyword) {
    const keywordIndex = line.toLowerCase().indexOf(keyword);
    if (keywordIndex === -1) {
      return '';
    }

    // Get everything after the keyword
    return line.substring(keywordIndex + keyword.length).trim();
  }

  /**
   * Extract address using regex patterns
   * @param {string} text - Text to search
   * @returns {string|null} Extracted address or null
   */
  extractByPatterns(text) {
    for (const pattern of this.patterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // Return first match that looks valid
        for (const match of matches) {
          if (this.isValidAddress(match)) {
            return this.cleanAddress(match);
          }
        }
      }
    }

    return null;
  }

  /**
   * Basic validation to check if extracted text looks like an address
   * @param {string} address - Address to validate
   * @returns {boolean} True if address looks valid
   */
  isValidAddress(address) {
    if (!address || address.length < 10) {
      return false;
    }

    // Must contain at least one number
    if (!/\d/.test(address)) {
      return false;
    }

    // Should not be too long (likely extracted too much)
    if (address.length > 200) {
      return false;
    }

    // Should have at least one comma or two spaces (multi-part address)
    if (!address.includes(',') && (address.match(/\s/g) || []).length < 2) {
      return false;
    }

    return true;
  }

  /**
   * Clean and format extracted address
   * @param {string} address - Address to clean
   * @returns {string} Cleaned address
   */
  cleanAddress(address) {
    let cleaned = address.trim();

    // Remove leading/trailing punctuation
    cleaned = cleaned.replace(/^[.,;:\s]+|[.,;:\s]+$/g, '');

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Capitalize first letter of each word for better presentation
    // (Optional - comment out if you want to preserve original casing)
    // cleaned = this.titleCase(cleaned);

    return cleaned;
  }

  /**
   * Convert string to title case
   * @param {string} str - String to convert
   * @returns {string} Title cased string
   */
  titleCase(str) {
    const exceptions = ['and', 'or', 'the', 'a', 'an', 'of', 'at', 'by', 'for', 'in', 'on', 'to', 'up', 'but', 'as'];

    return str.toLowerCase().split(' ').map((word, index) => {
      // Always capitalize first word
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }

      // Don't capitalize exceptions unless they're abbreviations (all caps)
      if (exceptions.includes(word) && word !== word.toUpperCase()) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  /**
   * Extract multiple addresses from text (if needed)
   * @param {string} text - Text to search
   * @returns {Array<string>} Array of found addresses
   */
  parseMultiple(text) {
    const addresses = [];

    // Try keyword-based extraction for all occurrences
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      for (const keyword of this.addressKeywords) {
        if (line.includes(keyword)) {
          const address = this.extractFromLine(lines[i], keyword);
          if (address && this.isValidAddress(address)) {
            addresses.push(this.cleanAddress(address));
          }
        }
      }
    }

    // Also try pattern matching
    for (const pattern of this.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = this.cleanAddress(match);
          if (this.isValidAddress(cleaned) && !addresses.includes(cleaned)) {
            addresses.push(cleaned);
          }
        });
      }
    }

    return [...new Set(addresses)]; // Remove duplicates
  }
}

export default AddressParser;
