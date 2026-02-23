/**
 * User Context Selector
 * Selects user role, service, and name for document generation
 */

interface UserContextSelectorProps {
  userContext: {
    role: 'MD' | 'NP' | 'PA' | 'RN' | 'PT' | 'ST' | 'RT' | 'WC' | 'PC' | 'CH' | 'OTHER';
    service?: string;
    name?: string;
  } | null;
  onContextChange: (context: UserContextSelectorProps['userContext']) => void;
}

export default function UserContextSelector({ userContext, onContextChange }: UserContextSelectorProps) {
  const roles: Array<{ value: UserContextSelectorProps['userContext']['role']; label: string }> = [
    { value: 'MD', label: 'Physician (MD)' },
    { value: 'NP', label: 'Nurse Practitioner (NP)' },
    { value: 'PA', label: 'Physician Assistant (PA)' },
    { value: 'RN', label: 'Registered Nurse (RN)' },
    { value: 'PT', label: 'Physical Therapy' },
    { value: 'ST', label: 'Speech Therapy' },
    { value: 'RT', label: 'Respiratory Therapy' },
    { value: 'WC', label: 'Wound Care' },
    { value: 'PC', label: 'Palliative Care' },
    { value: 'CH', label: 'Chaplain Services' },
    { value: 'OTHER', label: 'Other' },
  ];

  const services = [
    'Internal Medicine',
    'Cardiology',
    'Neurology',
    'Infectious Disease',
    'Critical Care',
    'Physical Therapy',
    'Speech Therapy',
    'Respiratory Therapy',
    'Wound Care',
    'Palliative Care',
  ];

  const handleRoleChange = (role: UserContextSelectorProps['userContext']['role']) => {
    onContextChange({
      role,
      service: undefined, // Reset service when role changes
      name: userContext?.name,
    });
  };

  const handleServiceChange = (service: string) => {
    if (!userContext) return;
    onContextChange({
      ...userContext,
      service: service || undefined,
    });
  };

  const handleNameChange = (name: string) => {
    if (!userContext) return;
    onContextChange({
      ...userContext,
      name: name || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">User Context</h3>
      
      {/* Role Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Role *
        </label>
        <select
          value={userContext?.role || ''}
          onChange={(e) => handleRoleChange(e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select Role</option>
          {roles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      {/* Service Selection */}
      {userContext?.role && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service (Optional)
          </label>
          <select
            value={userContext?.service || ''}
            onChange={(e) => handleServiceChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select Service</option>
            {services.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Name Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Name (Optional - for provider-specific templates)
        </label>
        <input
          type="text"
          value={userContext?.name || ''}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g., Dr. Smith, NP Martinez"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}

