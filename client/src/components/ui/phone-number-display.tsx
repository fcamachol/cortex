import { formatPhoneNumber, getCountryCode } from '@/lib/phoneUtils';

interface PhoneNumberDisplayProps {
  phoneNumber: string;
  className?: string;
  variant?: 'default' | 'simple';
}

export function PhoneNumberDisplay({ 
  phoneNumber, 
  className = "", 
  variant = 'default' 
}: PhoneNumberDisplayProps) {
  // Use libphonenumber-js to format the phone number
  const formattedNumber = formatPhoneNumber(phoneNumber);
  const countryCode = getCountryCode(phoneNumber);

  // Simple variant just shows the formatted number
  if (variant === 'simple') {
    return (
      <span className={`font-mono ${className}`}>
        {formattedNumber}
      </span>
    );
  }

  // Default variant with country flag and formatting
  return (
    <span className={`font-mono tracking-wide ${className}`}>
      {countryCode && (
        <span 
          className="text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded mr-2"
          title={`Country: ${countryCode}`}
        >
          {countryCode}
        </span>
      )}
      <span className="text-gray-900 dark:text-gray-100">
        {formattedNumber}
      </span>
    </span>
  );
}