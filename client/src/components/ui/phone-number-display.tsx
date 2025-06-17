interface PhoneNumberDisplayProps {
  phoneNumber: string;
  className?: string;
}

export function PhoneNumberDisplay({ phoneNumber, className = "" }: PhoneNumberDisplayProps) {
  // Parse E.164 format phone number
  const parsePhoneNumber = (phone: string) => {
    // Remove spaces and plus sign for parsing
    const cleanNumber = phone.replace(/[\s+]/g, '');
    
    // Handle US/Canada format: +1 XXX XXX XXXX
    if (phone.startsWith('+1') && cleanNumber.length === 11) {
      return {
        countryCode: '+1',
        areaCode: cleanNumber.slice(1, 4),
        firstGroup: cleanNumber.slice(4, 7),
        lastGroup: cleanNumber.slice(7)
      };
    }
    
    // Handle Mexico format: +52 XX XXXX XXXX
    if (phone.startsWith('+52') && cleanNumber.length === 12) {
      return {
        countryCode: '+52',
        areaCode: cleanNumber.slice(2, 4),
        firstGroup: cleanNumber.slice(4, 8),
        lastGroup: cleanNumber.slice(8)
      };
    }
    
    // Handle Spain format: +34 XXX XXX XXX
    if (phone.startsWith('+34') && cleanNumber.length === 11) {
      return {
        countryCode: '+34',
        areaCode: cleanNumber.slice(2, 5),
        firstGroup: cleanNumber.slice(5, 8),
        lastGroup: cleanNumber.slice(8)
      };
    }
    
    // Default fallback - try to parse as +XX XXX XXX XXXX
    const parts = phone.split(' ');
    if (parts.length >= 4) {
      return {
        countryCode: parts[0],
        areaCode: parts[1],
        firstGroup: parts[2],
        lastGroup: parts[3]
      };
    }
    
    // If parsing fails, return as-is
    return {
      countryCode: phone,
      areaCode: '',
      firstGroup: '',
      lastGroup: ''
    };
  };

  const { countryCode, areaCode, firstGroup, lastGroup } = parsePhoneNumber(phoneNumber);

  return (
    <span className={`font-mono tracking-wide ${className}`}>
      <span className="text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded">
        {countryCode}
      </span>
      {areaCode && (
        <>
          <span className="mx-1 text-gray-400">·</span>
          <span className="text-purple-600 dark:text-purple-400 font-medium bg-purple-50 dark:bg-purple-900/20 px-1 py-0.5 rounded">
            {areaCode}
          </span>
        </>
      )}
      {firstGroup && (
        <>
          <span className="mx-1 text-gray-400">·</span>
          <span className="text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-1 py-0.5 rounded">
            {firstGroup}
          </span>
        </>
      )}
      {lastGroup && (
        <>
          <span className="mx-1 text-gray-400">·</span>
          <span className="text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/20 px-1 py-0.5 rounded">
            {lastGroup}
          </span>
        </>
      )}
    </span>
  );
}