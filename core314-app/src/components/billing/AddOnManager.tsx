import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface AddOn {
  id: string;
  addon_name: string;
  addon_category: string;
  status: 'active' | 'pending' | 'canceled';
  activated_at?: string;
  expires_at?: string;
  metadata?: {
    price?: number;
    billing_period?: string;
  };
}

interface AvailableAddOn {
  name: string;
  category: string;
  description: string;
  price: number;
  stripePriceId: string;
}

interface AddOnManagerProps {
  activeAddOns: AddOn[];
  availableAddOns: AvailableAddOn[];
  onPurchaseAddOn: (addOn: AvailableAddOn) => Promise<void>;
  onCancelAddOn: (addOnId: string) => Promise<void>;
  loading?: boolean;
}

export const AddOnManager: React.FC<AddOnManagerProps> = ({
  activeAddOns,
  availableAddOns,
  onPurchaseAddOn,
  onCancelAddOn,
  loading = false,
}) => {
  const [processingAddOn, setProcessingAddOn] = useState<string | null>(null);

  const handlePurchase = async (addOn: AvailableAddOn) => {
    setProcessingAddOn(addOn.name);
    try {
      await onPurchaseAddOn(addOn);
    } finally {
      setProcessingAddOn(null);
    }
  };

  const handleCancel = async (addOnId: string) => {
    setProcessingAddOn(addOnId);
    try {
      await onCancelAddOn(addOnId);
    } finally {
      setProcessingAddOn(null);
    }
  };

  const isAddOnActive = (addOnName: string) => {
    return activeAddOns.some(
      (addon) => addon.addon_name === addOnName && addon.status === 'active'
    );
  };

  const getActiveAddOn = (addOnName: string) => {
    return activeAddOns.find(
      (addon) => addon.addon_name === addOnName && addon.status === 'active'
    );
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'integration':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'analytics':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
      case 'ai':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Active Add-Ons</h3>
        {activeAddOns.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No active add-ons. Browse available add-ons below to enhance your plan.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAddOns.map((addOn) => (
              <Card key={addOn.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{addOn.addon_name}</CardTitle>
                    <Badge className={getCategoryColor(addOn.addon_category)}>
                      {addOn.addon_category}
                    </Badge>
                  </div>
                  <CardDescription>
                    Active since {new Date(addOn.activated_at || '').toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancel(addOn.id)}
                    disabled={processingAddOn === addOn.id || loading}
                  >
                    {processingAddOn === addOn.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Canceling...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Cancel Add-On
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Available Add-Ons</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableAddOns.map((addOn) => {
            const isActive = isAddOnActive(addOn.name);
            const activeAddOn = getActiveAddOn(addOn.name);
            
            return (
              <Card key={addOn.name} className={isActive ? 'ring-2 ring-primary' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{addOn.name}</CardTitle>
                    <Badge className={getCategoryColor(addOn.category)}>
                      {addOn.category}
                    </Badge>
                  </div>
                  <CardDescription>{addOn.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPrice(addOn.price)}
                    <span className="text-sm text-muted-foreground font-normal">/mo</span>
                  </div>
                </CardContent>
                <CardFooter>
                  {isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => activeAddOn && handleCancel(activeAddOn.id)}
                      disabled={processingAddOn === activeAddOn?.id || loading}
                    >
                      {processingAddOn === activeAddOn?.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Canceling...
                        </>
                      ) : (
                        'Cancel Add-On'
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handlePurchase(addOn)}
                      disabled={processingAddOn === addOn.name || loading}
                    >
                      {processingAddOn === addOn.name ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Add to Plan
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
