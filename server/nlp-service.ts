import { parse, isValid } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface ParsedTask {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  tags: string[];
  confidence: number;
}

interface ParsedCalendarEvent {
  title: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number; // minutes
  location?: string;
  attendees: string[];
  shouldCreateMeetInvite?: boolean;
  confidence: number;
}

interface ParsedBill {
  vendor: string;
  amount?: number;
  currency: string;
  dueDate?: Date;
  category?: string;
  description?: string;
  confidence: number;
}

export class NLPService {
  private languageDetection(text: string): 'es' | 'en' {
    const spanishWords = ['para', 'con', 'que', 'una', 'del', 'las', 'los', 'por', 'como', 'pero', 'muy', 'hoy', 'mañana'];
    const spanishCount = spanishWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;
    
    return spanishCount > 0 ? 'es' : 'en';
  }

  async parse(messageContent: string, parserType: string): Promise<ParsedTask | ParsedCalendarEvent | ParsedBill | null> {
    console.log(`🧠 NLP parsing message: "${messageContent}" with parser: ${parserType}`);
    
    if (!messageContent || messageContent.trim().length === 0) {
      console.log('🧠 Empty message content, returning null');
      return null;
    }

    const language = this.languageDetection(messageContent);
    console.log(`🧠 Detected language: ${language}`);

    switch (parserType) {
      case 'task':
        return this.parseTask(messageContent, language);
      case 'calendar':
        return this.parseCalendarEvent(messageContent, language);
      case 'bill':
        return this.parseBill(messageContent, language);
      default:
        console.log(`🧠 Unknown parser type: ${parserType}`);
        return null;
    }
  }

  private parseTask(content: string, language: 'es' | 'en'): ParsedTask {
    const text = content.toLowerCase();
    let confidence = 0.7; // Base confidence

    // Extract title (first meaningful part of message)
    const title = this.extractTitle(content);
    
    // Extract priority
    const priority = this.extractPriority(text, language);
    if (priority !== 'medium') confidence += 0.1;

    // Extract due date
    const dueDate = this.extractDate(content, language);
    if (dueDate) confidence += 0.1;

    // Extract tags
    const tags = this.extractTags(text, language);
    if (tags.length > 0) confidence += 0.1;

    // Extract description (everything after first sentence)
    const description = this.extractDescription(content);

    console.log(`🧠 Task parsed: title="${title}", priority=${priority}, dueDate=${dueDate}, confidence=${confidence}`);

    return {
      title,
      description,
      priority,
      dueDate,
      tags,
      confidence: Math.min(confidence, 1.0)
    };
  }

  private parseCalendarEvent(content: string, language: 'es' | 'en'): ParsedCalendarEvent {
    const text = content.toLowerCase();
    let confidence = 0.7;

    // Extract title
    const title = this.extractTitle(content);
    
    // Extract dates and times
    const { startTime, endTime, duration } = this.extractEventTiming(content, language);
    if (startTime) confidence += 0.2;

    // Extract location
    const location = this.extractLocation(content, language);
    if (location) confidence += 0.1;

    // Extract attendees (emails, phone numbers, names)
    const attendees = this.extractAttendees(content);
    if (attendees.length > 0) confidence += 0.1;

    // Extract description
    const description = this.extractDescription(content);

    // Detect if Google Meet invite should be created
    const shouldCreateMeetInvite = this.shouldCreateMeetInvite(content, language);
    if (shouldCreateMeetInvite) confidence += 0.1;

    console.log(`🧠 Calendar event parsed: title="${title}", startTime=${startTime}, location="${location}", meetInvite=${shouldCreateMeetInvite}, confidence=${confidence}`);

    return {
      title,
      description,
      startTime,
      endTime,
      duration,
      location,
      attendees,
      shouldCreateMeetInvite,
      confidence: Math.min(confidence, 1.0)
    };
  }

  private parseBill(content: string, language: 'es' | 'en'): ParsedBill {
    const text = content.toLowerCase();
    let confidence = 0.7;

    // Extract vendor name (first meaningful entity or after "a", "de", "para")
    const vendor = this.extractVendor(content, language);
    
    // Extract amount and currency
    const { amount, currency } = this.extractAmount(content);
    if (amount) confidence += 0.2;

    // Extract due date
    const dueDate = this.extractDate(content, language);
    if (dueDate) confidence += 0.1;

    // Extract category
    const category = this.extractBillCategory(text, language);
    if (category) confidence += 0.1;

    // Extract description
    const description = this.extractDescription(content);

    console.log(`🧠 Bill parsed: vendor="${vendor}", amount=${amount} ${currency}, dueDate=${dueDate}, confidence=${confidence}`);

    return {
      vendor,
      amount,
      currency,
      dueDate,
      category,
      description,
      confidence: Math.min(confidence, 1.0)
    };
  }

  private extractTitle(content: string): string {
    // Get first sentence or up to 50 characters
    const sentences = content.split(/[.!?]/);
    const firstSentence = sentences[0].trim();
    
    if (firstSentence.length > 50) {
      return firstSentence.substring(0, 47) + '...';
    }
    
    return firstSentence || 'Nueva tarea';
  }

  private extractPriority(text: string, language: 'es' | 'en'): 'low' | 'medium' | 'high' {
    const highPriorityWords = language === 'es' 
      ? ['urgente', 'importante', 'crítico', 'prioritario', 'inmediato', 'rápido', 'ya']
      : ['urgent', 'important', 'critical', 'priority', 'immediate', 'asap', 'quick'];
    
    const lowPriorityWords = language === 'es'
      ? ['cuando', 'puedas', 'tiempo', 'libre', 'después', 'luego', 'opcional']
      : ['when', 'time', 'free', 'later', 'optional', 'eventually'];

    if (highPriorityWords.some(word => text.includes(word))) {
      return 'high';
    }
    
    if (lowPriorityWords.some(word => text.includes(word))) {
      return 'low';
    }
    
    return 'medium';
  }

  private extractDate(content: string, language: 'es' | 'en'): Date | undefined {
    const locale = language === 'es' ? es : enUS;
    
    // Common date patterns
    const datePatterns = [
      // Spanish patterns
      /(\d{1,2})[\s\/\-]de[\s\/\-](\w+)/i, // 15 de enero
      /(\w+)[\s\/\-](\d{1,2})/i, // enero 15
      /(\d{1,2})[\s\/\-](\d{1,2})[\s\/\-](\d{2,4})/i, // 15/01/2024
      
      // English patterns
      /(\w+)[\s\/\-](\d{1,2})[\s\/\-](\d{2,4})/i, // January 15 2024
      /(\d{1,2})[\s\/\-](\d{1,2})[\s\/\-](\d{2,4})/i, // 01/15/2024
      
      // Relative dates
      /(hoy|today)/i,
      /(mañana|tomorrow)/i,
      /(pasado[\s\/\-]mañana|day[\s\/\-]after[\s\/\-]tomorrow)/i
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          if (match[0].toLowerCase().includes('hoy') || match[0].toLowerCase().includes('today')) {
            return new Date();
          }
          if (match[0].toLowerCase().includes('mañana') || match[0].toLowerCase().includes('tomorrow')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
          }
          if (match[0].toLowerCase().includes('pasado') || match[0].toLowerCase().includes('day after')) {
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 2);
            return dayAfter;
          }
          
          const parsedDate = parse(match[0], 'dd/MM/yyyy', new Date(), { locale });
          if (isValid(parsedDate)) {
            return parsedDate;
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    return undefined;
  }

  private extractTags(text: string, language: 'es' | 'en'): string[] {
    const tags: string[] = [];
    
    // Work-related keywords
    const workKeywords = language === 'es' 
      ? ['trabajo', 'oficina', 'reunión', 'cliente', 'proyecto', 'empresa']
      : ['work', 'office', 'meeting', 'client', 'project', 'business'];
    
    // Personal keywords  
    const personalKeywords = language === 'es'
      ? ['personal', 'familia', 'casa', 'compras', 'médico', 'salud']
      : ['personal', 'family', 'home', 'shopping', 'medical', 'health'];

    if (workKeywords.some(keyword => text.includes(keyword))) {
      tags.push('trabajo');
    }
    
    if (personalKeywords.some(keyword => text.includes(keyword))) {
      tags.push('personal');
    }
    
    return tags;
  }

  private extractDescription(content: string): string | undefined {
    const sentences = content.split(/[.!?]/);
    if (sentences.length > 1) {
      return sentences.slice(1).join('. ').trim();
    }
    return undefined;
  }

  private extractEventTiming(content: string, language: 'es' | 'en'): { startTime?: Date, endTime?: Date, duration?: number } {
    // Extract time patterns like "a las 3pm", "at 3pm", "15:30"
    const timePatterns = [
      /(\d{1,2}):(\d{2})/g,
      /(\d{1,2})\s*(am|pm)/gi,
      /a\s*las\s*(\d{1,2})/gi,
      /at\s*(\d{1,2})/gi
    ];

    const times: Date[] = [];
    
    for (const pattern of timePatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        try {
          let hour = parseInt(match[1]);
          let minute = match[2] ? parseInt(match[2]) : 0;
          
          if (match[3] && match[3].toLowerCase() === 'pm' && hour !== 12) {
            hour += 12;
          }
          
          const time = new Date();
          time.setHours(hour, minute, 0, 0);
          times.push(time);
        } catch (error) {
          continue;
        }
      }
    }

    // Extract duration patterns like "1 hora", "30 minutos", "2 hours"
    const durationPatterns = [
      /(\d+)\s*(horas?|hours?)/gi,
      /(\d+)\s*(minutos?|minutes?|mins?)/gi
    ];

    let duration: number | undefined;
    
    for (const pattern of durationPatterns) {
      const match = content.match(pattern);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        if (unit.includes('hora') || unit.includes('hour')) {
          duration = value * 60;
        } else {
          duration = value;
        }
        break;
      }
    }

    return {
      startTime: times[0],
      endTime: times[1],
      duration
    };
  }

  private extractLocation(content: string, language: 'es' | 'en'): string | undefined {
    const locationPatterns = [
      /en\s+(.+?)(?:\s|$|[,.])/gi,
      /at\s+(.+?)(?:\s|$|[,.])/gi,
      /@\s*(.+?)(?:\s|$|[,.])/gi
    ];

    for (const pattern of locationPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim();
        if (location.length > 3 && location.length < 50) {
          return location;
        }
      }
    }
    
    return undefined;
  }

  private extractAttendees(content: string): string[] {
    const attendees: string[] = [];
    
    // Email pattern
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailPattern) || [];
    attendees.push(...emails);
    
    // Phone number pattern (Mexican format)
    const phonePattern = /\b(?:\+52\s?)?(?:\d{3}\s?\d{3}\s?\d{4}|\d{10})\b/g;
    const phones = content.match(phonePattern) || [];
    attendees.push(...phones);
    
    return attendees;
  }

  private extractVendor(content: string, language: 'es' | 'en'): string {
    // Look for patterns like "pagar a", "pay to", "bill from"
    const vendorPatterns = [
      /(?:pagar\s+a|para)\s+(.+?)(?:\s|$|[,.])/gi,
      /(?:pay\s+to|bill\s+from)\s+(.+?)(?:\s|$|[,.])/gi,
      /(.+?)(?:\s+factura|\s+bill)/gi
    ];

    for (const pattern of vendorPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const vendor = match[1].trim();
        if (vendor.length > 2 && vendor.length < 50) {
          return vendor;
        }
      }
    }
    
    // Fallback: use first meaningful word
    const words = content.split(/\s+/).filter(word => word.length > 2);
    return words[0] || 'Proveedor desconocido';
  }

  private extractAmount(content: string): { amount?: number, currency: string } {
    // Currency patterns
    const currencyPatterns = [
      /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g, // $1,234.56
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:pesos?|mxn|usd|dollars?)/gi,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)/g // Any number
    ];

    for (const pattern of currencyPatterns) {
      const match = content.match(pattern);
      if (match) {
        const amountStr = match[1] || match[0];
        const amount = parseFloat(amountStr.replace(/,/g, '').replace('$', ''));
        
        if (!isNaN(amount) && amount > 0) {
          // Detect currency
          const text = content.toLowerCase();
          let currency = 'MXN'; // Default
          
          if (text.includes('usd') || text.includes('dollar')) {
            currency = 'USD';
          } else if (text.includes('eur') || text.includes('euro')) {
            currency = 'EUR';
          }
          
          return { amount, currency };
        }
      }
    }
    
    return { currency: 'MXN' };
  }

  private extractBillCategory(text: string, language: 'es' | 'en'): string | undefined {
    const categories = language === 'es' ? {
      'utilities': ['luz', 'agua', 'gas', 'electricidad', 'internet', 'teléfono'],
      'food': ['comida', 'restaurant', 'super', 'mercado', 'groceries'],
      'transport': ['gasolina', 'uber', 'taxi', 'metro', 'transporte'],
      'medical': ['médico', 'doctor', 'farmacia', 'hospital', 'medicina'],
      'education': ['escuela', 'universidad', 'curso', 'libro', 'educación'],
      'entertainment': ['cine', 'teatro', 'juego', 'entretenimiento']
    } : {
      'utilities': ['electricity', 'water', 'gas', 'internet', 'phone', 'utility'],
      'food': ['food', 'restaurant', 'grocery', 'market', 'dining'],
      'transport': ['gas', 'fuel', 'uber', 'taxi', 'transport', 'car'],
      'medical': ['medical', 'doctor', 'pharmacy', 'hospital', 'medicine'],
      'education': ['school', 'university', 'course', 'book', 'education'],
      'entertainment': ['movie', 'theater', 'game', 'entertainment']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }
    
    return undefined;
  }

  private shouldCreateMeetInvite(content: string, language: 'es' | 'en'): boolean {
    const text = content.toLowerCase();
    
    // Keywords that indicate a virtual meeting
    const virtualMeetingKeywords = language === 'es' 
      ? [
          'zoom', 'meet', 'google meet', 'teams', 'skype', 'videollamada', 'videoconferencia',
          'virtual', 'online', 'remoto', 'desde casa', 'por video', 'llamada',
          'conectarse', 'enlace', 'link', 'reunión virtual', 'junta virtual'
        ]
      : [
          'zoom', 'meet', 'google meet', 'teams', 'skype', 'video call', 'video conference',
          'virtual', 'online', 'remote', 'from home', 'video', 'call',
          'join', 'link', 'virtual meeting', 'online meeting'
        ];

    // Team meeting keywords (often virtual)
    const teamKeywords = language === 'es'
      ? ['equipo', 'team', 'standup', 'scrum', 'sprint', 'review', 'planning']
      : ['team', 'standup', 'scrum', 'sprint', 'review', 'planning', 'sync'];

    // Check for explicit virtual meeting indicators
    const hasVirtualKeyword = virtualMeetingKeywords.some(keyword => text.includes(keyword));
    
    // Check for team meetings (commonly virtual)
    const hasTeamKeyword = teamKeywords.some(keyword => text.includes(keyword));
    
    // Check for multiple attendees (more likely to need virtual access)
    const attendeePattern = /(invite|invitar|incluir|con|with)\s+[\w\s,]+/gi;
    const hasMultipleAttendees = attendeePattern.test(content);
    
    // Location analysis - if no physical location specified, likely virtual
    const physicalLocationPattern = /(sala|room|oficina|office|conference|meeting room|building)/i;
    const hasPhysicalLocation = physicalLocationPattern.test(content);
    
    console.log(`🧠 Meet invite analysis: virtual=${hasVirtualKeyword}, team=${hasTeamKeyword}, attendees=${hasMultipleAttendees}, physical=${hasPhysicalLocation}`);
    
    // Create meet invite if:
    // 1. Explicitly mentions virtual meeting tools
    // 2. Team meeting with multiple attendees and no physical location
    // 3. Has multiple attendees but no specific physical location
    return hasVirtualKeyword || 
           (hasTeamKeyword && hasMultipleAttendees && !hasPhysicalLocation) ||
           (hasMultipleAttendees && !hasPhysicalLocation);
  }
}

export const nlpService = new NLPService();