interface PhoneNumberDisplayProps {
  phoneNumber: string;
  className?: string;
}

export function PhoneNumberDisplay({ phoneNumber, className = "" }: PhoneNumberDisplayProps) {
  // Parse phone number and format as (country code) (first 3) (second 3) (last 4)
  const parsePhoneNumber = (phone: string) => {
    // Remove all non-digit characters except the initial +
    const cleanNumber = phone.replace(/[^\d+]/g, '');
    
    // Extract country code (+ followed by 1-3 digits)
    const countryCodeMatch = cleanNumber.match(/^(\+\d{1,3})/);
    if (!countryCodeMatch) {
      // If no country code, return as-is
      return {
        countryCode: phone,
        firstGroup: '',
        secondGroup: '',
        lastGroup: ''
      };
    }
    
    const countryCode = countryCodeMatch[1];
    const remainingDigits = cleanNumber.slice(countryCode.length);
    
    // Format remaining digits as XXX XXX XXXX (3-3-4 pattern)
    if (remainingDigits.length >= 10) {
      return {
        countryCode,
        firstGroup: remainingDigits.slice(0, 3),
        secondGroup: remainingDigits.slice(3, 6),
        lastGroup: remainingDigits.slice(6, 10)
      };
    } else if (remainingDigits.length >= 7) {
      // For shorter numbers, try to fit 3-3-X pattern
      return {
        countryCode,
        firstGroup: remainingDigits.slice(0, 3),
        secondGroup: remainingDigits.slice(3, 6),
        lastGroup: remainingDigits.slice(6)
      };
    } else if (remainingDigits.length >= 4) {
      // For even shorter numbers, try 3-X pattern
      return {
        countryCode,
        firstGroup: remainingDigits.slice(0, 3),
        secondGroup: '',
        lastGroup: remainingDigits.slice(3)
      };
    } else {
      // Very short number, just show with country code
      return {
        countryCode,
        firstGroup: remainingDigits,
        secondGroup: '',
        lastGroup: ''
      };
    }
  };

  const { countryCode, firstGroup, secondGroup, lastGroup } = parsePhoneNumber(phoneNumber);

  return (
    <span className={`font-mono tracking-wide ${className}`}>
      <span className="text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded">
        {countryCode}
      </span>
      {firstGroup && (
        <>
          <span className="mx-1 text-gray-400">·</span>
          <span className="text-purple-600 dark:text-purple-400 font-medium bg-purple-50 dark:bg-purple-900/20 px-1 py-0.5 rounded">
            {firstGroup}
          </span>
        </>
      )}
      {secondGroup && (
        <>
          <span className="mx-1 text-gray-400">·</span>
          <span className="text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-1 py-0.5 rounded">
            {secondGroup}
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