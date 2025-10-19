import { useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { Button } from './ui/button';
import { ChevronDown, Building2, Check } from 'lucide-react';

export function OrganizationSwitcher() {
  const { currentOrganization, organizations, switchOrganization } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  if (organizations.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center min-w-0 flex-1">
          <Building2 className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{currentOrganization?.name || 'Select Organization'}</span>
        </div>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 mt-2 z-20 rounded-md border bg-white dark:bg-gray-800 shadow-lg">
            <div className="p-2">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    switchOrganization(org.id);
                    setIsOpen(false);
                  }}
                >
                  <span>{org.name}</span>
                  {currentOrganization?.id === org.id && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
