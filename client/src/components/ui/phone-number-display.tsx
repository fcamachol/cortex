interface PhoneNumberDisplayProps {
  phoneNumber: string;
  className?: string;
}

export function PhoneNumberDisplay({ phoneNumber, className = "" }: PhoneNumberDisplayProps) {
  // Format phone number as +1 510 316 5094 (simple space-separated format)
  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digit characters except the initial +
    const cleanNumber = phone.replace(/[^\d+]/g, '');
    
    // Extract country code (+ followed by 1-3 digits)
    const countryCodeMatch = cleanNumber.match(/^(\+\d{1,3})/);
    if (!countryCodeMatch) {
      // If no country code, return as-is
      return phone;
    }
    
    const countryCode = countryCodeMatch[1];
    const remainingDigits = cleanNumber.slice(countryCode.length);
    
    // Format based on country code and number length
    if (countryCode === '+1' && remainingDigits.length === 10) {
      // US/Canada format: +1 510 316 5094
      return `${countryCode} ${remainingDigits.slice(0, 3)} ${remainingDigits.slice(3, 6)} ${remainingDigits.slice(6)}`;
    } else if (countryCode === '+52' && remainingDigits.length >= 10) {
      // Mexico format: +52 55 79 18 8699
      return `${countryCode} ${remainingDigits.slice(0, 2)} ${remainingDigits.slice(2, 4)} ${remainingDigits.slice(4, 6)} ${remainingDigits.slice(6)}`;
    } else if (remainingDigits.length >= 10) {
      // Standard international format: +XX XXX XXX XXXX
      return `${countryCode} ${remainingDigits.slice(0, 3)} ${remainingDigits.slice(3, 6)} ${remainingDigits.slice(6)}`;
    } else if (remainingDigits.length >= 6) {
      // Shorter format: +XX XXX XXX
      return `${countryCode} ${remainingDigits.slice(0, 3)} ${remainingDigits.slice(3)}`;
    } else {
      // Very short number, just add space after country code
      return `${countryCode} ${remainingDigits}`;
    }
  };

  const formattedNumber = formatPhoneNumber(phoneNumber);

  return (
    <span className={`font-mono ${className}`}>
      {formattedNumber}
    </span>
  );
}