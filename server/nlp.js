/**
 * Enhanced NLP Processing Module
 * Specialized for Spanish WhatsApp bill parsing with improved vendor extraction
 * Using suggested architecture: chrono-node + franc + currency.js + NLP.js
 */

import * as chrono from 'chrono-node';
import { franc } from 'franc';
import currency from 'currency.js';
// NLP.js imports temporarily disabled for testing
// import { dockStart } from '@nlpjs/basic';
import compromise from 'compromise';
import natural from 'natural';

// Configure Spanish locale for chrono
const chronoEs = chrono.es;

/**
 * Enhanced Spanish Bill Parser
 * Using suggested architecture: chrono-node + franc + currency.js + NLP.js
 * Handles patterns like "Pago 1900 a Lalo Costco" → vendor: "Lalo"
 */
class EnhancedBillParser {
  constructor() {
    // Enhanced pattern matching with NLP.js architecture foundation
    this.manager = null;
    // Initialize without NLP.js for now - focus on enhanced patterns
    console.log('🧠 Enhanced Bill Parser initialized with pattern matching');
    
    // Spanish payment keywords
    this.paymentKeywords = [
      'pago', 'pagar', 'pagué', 'pagó', 'payment', 'paid', 'pay',
      'factura', 'bill', 'cuenta', 'cobro', 'recibo'
    ];
    
    // Spanish vendor prepositions
    this.vendorPrepositions = ['a', 'para', 'de', 'to', 'from', 'at'];
    
    // Enhanced Mexican currency patterns
    this.currencyPatterns = [
      /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:pesos?|mx[np]?|mex)/gi,
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:usd|dollars?)/gi
    ];
  }

  // NLP.js initialization temporarily disabled for testing - focus on enhanced patterns

  /**
   * Enhanced vendor extraction using NLP.js + pattern matching
   * "Pago 1900 a Lalo Costco" → "Lalo"
   * "Factura de Walmart 500" → "Walmart"
   */
  async extractVendor(content) {
    console.log(`🏪 Enhanced vendor extraction from: "${content}"`);
    
    // First try NLP.js entity recognition if available
    if (this.manager) {
      try {
        const response = await this.manager.process('es', content);
        
        // Extract vendor entities from NLP.js
        if (response.entities && response.entities.length > 0) {
          const vendorEntity = response.entities.find(e => e.entity === 'vendor');
          if (vendorEntity) {
            console.log(`🏪 Vendor extracted via NLP.js: "${vendorEntity.sourceText}"`);
            return vendorEntity.sourceText;
          }
        }
      } catch (error) {
        console.log(`⚠️ NLP.js processing failed, falling back to patterns`);
      }
    }
    
    // Pattern 1: "Pago [amount] a [Vendor] [Optional Store]"
    const pagoPattern = /(?:pago|pagué|payment|paid)\s+\d+[\d.,]*\s+(?:a|para|to)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]+)(?:\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]+))?/gi;
    let match = pagoPattern.exec(content);
    if (match && match[1]) {
      const vendor = match[1].trim();
      console.log(`🏪 Vendor extracted via "pago a" pattern: "${vendor}"`);
      return vendor;
    }

    // Pattern 2: "Factura de [Vendor]"
    const facturaPattern = /(?:factura|bill|invoice)\s+(?:de|from|of)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ\s]+?)(?:\s|$|[,.])/gi;
    match = facturaPattern.exec(content);
    if (match && match[1]) {
      const vendor = match[1].trim();
      console.log(`🏪 Vendor extracted via "factura de" pattern: "${vendor}"`);
      return vendor;
    }

    // Pattern 3: "[Vendor] factura/bill"
    const vendorBillPattern = /([A-Za-zÁÉÍÓÚáéíóúÑñ\s]+?)\s+(?:factura|bill|invoice)/gi;
    match = vendorBillPattern.exec(content);
    if (match && match[1]) {
      const vendor = match[1].trim();
      if (vendor.length > 2 && vendor.length < 30) {
        console.log(`🏪 Vendor extracted via "[vendor] factura" pattern: "${vendor}"`);
        return vendor;
      }
    }

    // Final fallback: First meaningful word (skip payment terms)
    const words = content.split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.paymentKeywords.includes(word.toLowerCase()))
      .filter(word => !/^\d+[\d.,]*$/.test(word))
      .filter(word => !this.vendorPrepositions.includes(word.toLowerCase()));
      
    const vendor = words[0] || 'Proveedor desconocido';
    console.log(`🏪 Vendor extracted via fallback: "${vendor}"`);
    return vendor;
  }

  /**
   * Extract entities using compromise NLP
   */
  extractEntitiesWithNLP(content) {
    const doc = nlp(content);
    const people = doc.people().out('array');
    const places = doc.places().out('array');
    const organizations = doc.organizations().out('array');
    
    // Combine all entities and filter out payment terms
    const allEntities = [...people, ...places, ...organizations]
      .filter(entity => entity.length > 2)
      .filter(entity => !this.paymentKeywords.includes(entity.toLowerCase()));
    
    return allEntities;
  }

  /**
   * Enhanced amount extraction with Mexican peso support
   */
  extractAmount(content) {
    console.log(`💰 Extracting amount from: "${content}"`);
    
    let amount = null;
    let currency = 'MXN'; // Default to Mexican pesos
    
    // Try all currency patterns with Mexican formatting support
    for (const pattern of this.currencyPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        const amountStr = matches[0].replace(/[^\d.,]/g, '');
        
        // Mexican formatting: comma as thousands separator, period as decimal
        // Examples: 5,000 = 5000, 1,234.56 = 1234.56
        let parsedAmount;
        
        if (amountStr.includes(',') && amountStr.includes('.')) {
          // Format like 1,234.56 - comma is thousands, period is decimal
          parsedAmount = parseFloat(amountStr.replace(/,/g, ''));
        } else if (amountStr.includes(',') && !amountStr.includes('.')) {
          // Format like 5,000 - comma is thousands separator
          parsedAmount = parseFloat(amountStr.replace(/,/g, ''));
        } else {
          // Simple number without comma
          parsedAmount = parseFloat(amountStr);
        }
        
        if (!isNaN(parsedAmount) && parsedAmount > 0) {
          amount = parsedAmount;
          
          // Determine currency from context
          if (matches[0].toLowerCase().includes('usd') || matches[0].toLowerCase().includes('dollar')) {
            currency = 'USD';
          } else {
            currency = 'MXN';
          }
          
          console.log(`💰 Amount extracted: ${amount} ${currency} (from: "${amountStr}")`);
          break;
        }
      }
    }
    
    // Fallback: Look for standalone numbers with Mexican thousands separator support
    if (!amount) {
      const numberPattern = /\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b/g;
      const matches = content.match(numberPattern);
      if (matches) {
        // Handle Mexican formatting - remove commas for thousands separator
        const amountStr = matches[0];
        amount = parseFloat(amountStr.replace(/,/g, ''));
        console.log(`💰 Amount extracted via fallback: ${amount} ${currency} (from: "${amountStr}")`);
      }
    }
    
    return { amount, currency };
  }

  /**
   * Enhanced date extraction using chrono for Spanish
   */
  extractDueDate(content) {
    console.log(`📅 Extracting due date from: "${content}"`);
    
    // Use chrono Spanish locale
    const results = chronoEs.parse(content);
    
    if (results.length > 0) {
      const dueDate = results[0].start.date();
      console.log(`📅 Due date extracted: ${dueDate}`);
      return dueDate;
    }
    
    // Fallback patterns for Spanish dates
    const spanishDatePatterns = [
      /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/gi,
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g,
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/g
    ];
    
    for (const pattern of spanishDatePatterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          const dueDate = new Date(match[0]);
          if (!isNaN(dueDate.getTime())) {
            console.log(`📅 Due date extracted via pattern: ${dueDate}`);
            return dueDate;
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    console.log(`📅 No due date found`);
    return null;
  }

  /**
   * Extract bill category from content
   */
  extractCategory(content) {
    const categories = {
      'comida': ['comida', 'restaurante', 'food', 'restaurant', 'café', 'coffee'],
      'transporte': ['uber', 'taxi', 'gasolina', 'gas', 'transport'],
      'servicios': ['luz', 'agua', 'internet', 'telefono', 'electricity', 'water'],
      'compras': ['walmart', 'costco', 'supermarket', 'tienda', 'store', 'shopping'],
      'salud': ['doctor', 'medicina', 'farmacia', 'hospital', 'health'],
      'entretenimiento': ['cine', 'movie', 'netflix', 'spotify', 'entertainment']
    };
    
    const lowerContent = content.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerContent.includes(keyword))) {
        console.log(`🏷️ Category detected: ${category}`);
        return category;
      }
    }
    
    return 'general';
  }

  /**
   * Language detection with enhanced Spanish support
   */
  detectLanguage(content) {
    if (!content || typeof content !== 'string' || content.length < 3) {
      return 'es'; // Default to Spanish for short/invalid content
    }
    
    const detectedLang = franc(content);
    
    // Common Spanish indicators
    const spanishWords = ['pago', 'factura', 'para', 'con', 'que', 'una', 'del', 'las', 'los'];
    const spanishCount = spanishWords.filter(word => 
      content.toLowerCase().includes(word)
    ).length;
    
    if (spanishCount >= 2 || detectedLang === 'spa') {
      return 'es';
    }
    
    return 'en';
  }

  /**
   * Multi-entity detection - determines if message contains multiple bills or tasks
   */
  detectMultipleEntities(content) {
    const lines = content.split('\n').filter(line => line.trim());
    
    // Count bullet points and list indicators
    const bulletLines = lines.filter(line => 
      /^\s*[-*•]\s/.test(line) || /^\s*\d+\.\s/.test(line)
    ).length;
    
    // Count amounts for bills
    const amountMatches = content.match(/\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g) || [];
    
    // Count task indicators
    const taskIndicators = lines.filter(line => 
      /^\s*[-*•]\s.*(?:task|proyecto|hacer|completar|realizar)/i.test(line) ||
      /(?:design|create|write|code|backend|frontend|wireframe)/i.test(line)
    ).length;
    
    return {
      isMultipleBills: bulletLines >= 3 && amountMatches.length >= 3,
      isMultipleTasks: bulletLines >= 2 && (taskIndicators >= 1 || /project|tasks|todo/i.test(content)),
      bulletCount: bulletLines,
      amountCount: amountMatches.length,
      taskIndicatorCount: taskIndicators
    };
  }

  /**
   * Enhanced task parser with subtask detection
   */
  extractMultipleTasks(message, language = 'es') {
    const tasks = [];
    const lines = message.split('\n');
    
    let currentTask = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Detect indentation level
      const indent = line.length - trimmed.length;
      const isSubtask = indent >= 2 || /^\s{2,}[-*•]/.test(line);
      
      if (isSubtask && currentTask) {
        // Add as subtask
        if (!currentTask.subtasks) currentTask.subtasks = [];
        currentTask.subtasks.push({
          title: this.cleanTaskText(trimmed),
          completed: false
        });
      } else {
        // New main task
        if (currentTask) tasks.push(currentTask);
        
        currentTask = {
          title: this.cleanTaskText(trimmed),
          priority: this.extractPriority(trimmed, language) || 'medium',
          dueDate: chronoEs.parseDate(trimmed),
          subtasks: []
        };
      }
    }
    
    if (currentTask) tasks.push(currentTask);
    return tasks;
  }

  /**
   * Clean task text from bullets and formatting
   */
  cleanTaskText(text) {
    return text
      .replace(/^\s*[-*•]\s*/, '')
      .replace(/^\s*\d+\.\s*/, '')
      .trim();
  }

  /**
   * Extract task priority from text
   */
  extractPriority(text, language) {
    const priorityPatterns = {
      high: /urgent|critical|importante|urgente|alta|high/i,
      medium: /normal|medium|media|moderado/i,
      low: /low|baja|minor|opcional/i
    };
    
    for (const [priority, pattern] of Object.entries(priorityPatterns)) {
      if (pattern.test(text)) return priority;
    }
    
    return 'medium';
  }

  /**
   * Multiple bills detection and extraction
   */
  detectMultipleBills(message, language = 'es') {
    console.log(`🧠 Detecting multiple bills in message: "${message.substring(0, 100)}..."`);
    
    // Split by line breaks and bullets
    const lines = message.split(/\n/).filter(line => line.trim());
    const bills = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('*')) continue; // Skip titles
      
      // Check if line contains amount and vendor info
      const hasAmount = /\$?\s*\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?/.test(trimmed);
      if (!hasAmount) continue;
      
      const bill = this.extractSingleBillFromLine(trimmed, language);
      if (bill) {
        bills.push(bill);
      }
    }
    
    console.log(`🧠 Extracted ${bills.length} bills from multi-bill message`);
    return bills;
  }

  /**
   * Extract single bill from a line
   */
  extractSingleBillFromLine(line, language) {
    console.log(`🏪 Processing bill line: "${line}"`);
    
    // Clean line of bullet points
    const cleaned = line.replace(/^\s*[-*•]\s*/, '').trim();
    
    // Extract amount with Mexican formatting support
    const amountMatch = cleaned.match(/\$?\s*(\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?)/);
    if (!amountMatch) return null;
    
    // Mexican formatting: comma as thousands separator, period as decimal
    // Examples: 5,000 = 5000, 1,234.56 = 1234.56
    const amountStr = amountMatch[1];
    let amount;
    
    if (amountStr.includes(',') && amountStr.includes('.')) {
      // Format like 1,234.56 - comma is thousands, period is decimal
      amount = parseFloat(amountStr.replace(/,/g, ''));
    } else if (amountStr.includes(',') && !amountStr.includes('.')) {
      // Format like 5,000 - comma is thousands separator
      amount = parseFloat(amountStr.replace(/,/g, ''));
    } else {
      // Simple number without comma
      amount = parseFloat(amountStr);
    }
    
    // Extract vendor (everything before amount or colon)
    let vendor = cleaned.split(/[\$\d]/)[0].trim();
    if (!vendor) {
      vendor = cleaned.split(':')[0].trim();
    }
    vendor = vendor.replace(/^\s*[-*•]\s*/, '').trim();
    
    // Extract due date if present
    let dueDate = null;
    const dateText = cleaned.toLowerCase();
    if (language === 'es') {
      // Spanish date patterns
      const spanishDates = chronoEs.parse(cleaned);
      if (spanishDates.length > 0) {
        dueDate = spanishDates[0].start.date();
      }
    }
    
    // Determine bill type and priority
    const billType = this.categorizeBillType(vendor, cleaned);
    const priority = this.determineBillPriority(cleaned, dueDate);
    
    // Check if overdue
    const isOverdue = dueDate && dueDate < new Date();
    
    return {
      vendor: vendor || 'Unknown',
      amount: { value: amount, currency: 'MXN' },
      dueDate,
      billType,
      notes: cleaned,
      priority,
      isOverdue,
      originalText: line,
      confidence: this.calculateBillConfidence(vendor, amount, cleaned)
    };
  }

  /**
   * Categorize bill type based on vendor and content
   */
  categorizeBillType(vendor, content) {
    const types = {
      credit_card: /tarjeta|card|credit/i,
      membership: /club|gym|membership|suscripción/i,
      loan: /crédito|préstamo|loan/i,
      education: /colegiatura|escuela|school|universidad/i,
      utilities: /agua|luz|gas|electric|water|internet/i,
      maintenance: /mantenimiento|maintenance|repair/i,
      personal: /\b[A-Z][a-z]+\b.*\d+$/ // Name pattern with amount
    };
    
    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(vendor + ' ' + content)) {
        return type;
      }
    }
    
    return 'general';
  }

  /**
   * Determine bill priority based on content and due date
   */
  determineBillPriority(content, dueDate) {
    // High priority indicators
    if (/urgent|crítico|intereses|vence|overdue|venció/i.test(content)) {
      return 'high';
    }
    
    // Due soon (within 7 days)
    if (dueDate) {
      const daysDiff = Math.floor((dueDate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 7) return 'high';
      if (daysDiff <= 30) return 'medium';
    }
    
    return 'medium';
  }

  /**
   * Calculate confidence score for bill extraction
   */
  calculateBillConfidence(vendor, amount, content) {
    let confidence = 0.5;
    
    if (vendor && vendor.length > 2) confidence += 0.2;
    if (amount > 0) confidence += 0.2;
    if (/\$|pesos?|mx[np]?/i.test(content)) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Main parsing method for bills using enhanced NLP.js architecture
   */
  async parseBill(content) {
    console.log(`🧠 Enhanced bill parsing with NLP.js: "${content}"`);
    
    const language = this.detectLanguage(content);
    console.log(`🌐 Language detected: ${language}`);
    
    // Check if this is a multi-entity message
    const multiCheck = this.detectMultipleEntities(content);
    console.log(`🔍 Multi-entity detection:`, multiCheck);
    
    if (multiCheck.isMultipleBills) {
      console.log(`🧠 Processing multiple bills detected`);
      const bills = this.detectMultipleBills(content, language);
      return {
        type: 'multiple_bills',
        data: { bills },
        language,
        confidence: 0.9,
        extractionMethod: 'multi-entity nlp.js'
      };
    }
    
    // Single bill processing
    const vendor = await this.extractVendor(content);
    const { amount, currency } = this.extractAmount(content);
    const dueDate = this.extractDueDate(content);
    const category = this.extractCategory(content);
    
    // Calculate confidence score with NLP.js boost
    let confidence = 0.6; // Base confidence
    if (vendor && vendor !== 'Proveedor desconocido') confidence += 0.25; // Higher weight for NLP.js extraction
    if (amount && amount > 0) confidence += 0.2;
    if (dueDate) confidence += 0.1;
    if (category && category !== 'general') confidence += 0.1;
    
    const result = {
      type: 'single_bill',
      vendor,
      amount,
      currency,
      dueDate,
      category,
      description: content,
      language,
      confidence: Math.min(confidence, 1.0),
      extractionMethod: 'nlp.js + patterns' // Track extraction method
    };
    
    console.log(`🧠 Enhanced NLP.js parsing result:`, result);
    return result;
  }

  /**
   * Main parsing method for tasks using enhanced NLP.js architecture
   */
  async parseTask(content) {
    console.log(`🧠 Enhanced task parsing with NLP.js: "${content}"`);
    
    const language = this.detectLanguage(content);
    console.log(`🌐 Language detected: ${language}`);
    
    // Check if this is a multi-entity message
    const multiCheck = this.detectMultipleEntities(content);
    console.log(`🔍 Multi-entity detection:`, multiCheck);
    
    if (multiCheck.isMultipleTasks) {
      console.log(`🧠 Processing multiple tasks detected`);
      const tasks = this.extractMultipleTasks(content, language);
      return {
        type: 'multiple_tasks',
        data: { tasks },
        language,
        confidence: 0.9,
        extractionMethod: 'multi-entity nlp.js'
      };
    }
    
    // Single task processing
    const title = this.cleanTaskText(content);
    const priority = this.extractPriority(content, language);
    const dueDate = chronoEs.parseDate(content);
    
    const result = {
      type: 'single_task',
      title,
      priority,
      dueDate,
      description: content,
      language,
      confidence: 0.8,
      extractionMethod: 'nlp.js + patterns'
    };
    
    console.log(`🧠 Enhanced NLP.js task parsing result:`, result);
    return result;
  }
}

// Export the enhanced parser
export const enhancedBillParser = new EnhancedBillParser();

// Main parsing function for integration (async)
export async function parseEnhancedBill(content) {
  return await enhancedBillParser.parseBill(content);
}

// Task parsing function for integration (async)
export async function parseEnhancedTask(content) {
  return await enhancedBillParser.parseTask(content);
}

// Multi-entity detection function
export function detectMultipleEntities(content) {
  return enhancedBillParser.detectMultipleEntities(content);
}

// Multiple bills extraction
export function extractMultipleBills(content, language = 'es') {
  return enhancedBillParser.detectMultipleBills(content, language);
}

// Multiple tasks extraction
export function extractMultipleTasks(content, language = 'es') {
  return enhancedBillParser.extractMultipleTasks(content, language);
}