import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { IntegrationWithScore } from '../../types';
import { Layers, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IntegrationContextSelectorProps {
  integrations: IntegrationWithScore[];
  selectedIntegrationId: string;
  onSelectionChange: (integrationId: string) => void;
}

export function IntegrationContextSelector({
  integrations,
  selectedIntegrationId,
  onSelectionChange,
}: IntegrationContextSelectorProps) {
  const navigate = useNavigate();
  const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId);
  
  const handleSelectionChange = (value: string) => {
    if (value === 'all') {
      onSelectionChange(value);
    } else {
      const integration = integrations.find(i => i.id === value);
      if (integration) {
        navigate(`/dashboard/${integration.integration_type}`);
      }
    }
  };
  
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Layers className="h-4 w-4" />
        <span className="font-medium">Viewing:</span>
      </div>
      <Select value={selectedIntegrationId} onValueChange={handleSelectionChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue>
            {selectedIntegrationId === 'all' ? (
              'All Integrations'
            ) : selectedIntegration ? (
              <div className="flex items-center gap-2">
                {selectedIntegration.logo_url && (
                  <img 
                    src={selectedIntegration.logo_url} 
                    alt="" 
                    className="w-4 h-4 object-contain"
                  />
                )}
                <span>{selectedIntegration.integration_name}</span>
              </div>
            ) : (
              'All Integrations'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-gray-500" />
              <span>All Integrations</span>
            </div>
          </SelectItem>
          {integrations.map((integration) => (
            <SelectItem key={integration.id} value={integration.id}>
              <div className="flex items-center gap-2">
                {integration.logo_url && (
                  <img 
                    src={integration.logo_url} 
                    alt="" 
                    className="w-4 h-4 object-contain"
                  />
                )}
                <span>{integration.integration_name}</span>
                <ExternalLink className="h-3 w-3 text-gray-400 ml-auto" />
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
