import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { DollarSign, TrendingUp, Users, CreditCard } from 'lucide-react';

interface RevenueSummaryProps {
  totalMRR: number;
  totalARR: number;
  activeSubscriptions: number;
  churnRate: number;
}

export const RevenueSummary: React.FC<RevenueSummaryProps> = ({
  totalMRR,
  totalARR,
  activeSubscriptions,
  churnRate,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const summaryCards = [
    {
      title: 'Monthly Recurring Revenue',
      value: formatCurrency(totalMRR),
      icon: DollarSign,
      trend: '+12.5%',
      trendUp: true,
    },
    {
      title: 'Annual Recurring Revenue',
      value: formatCurrency(totalARR),
      icon: TrendingUp,
      trend: '+8.3%',
      trendUp: true,
    },
    {
      title: 'Active Subscriptions',
      value: activeSubscriptions.toString(),
      icon: Users,
      trend: '+5',
      trendUp: true,
    },
    {
      title: 'Churn Rate',
      value: formatPercentage(churnRate),
      icon: CreditCard,
      trend: '-0.5%',
      trendUp: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {summaryCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className={`text-xs ${card.trendUp ? 'text-green-600' : 'text-red-600'} flex items-center mt-1`}>
                <span>{card.trend}</span>
                <span className="text-muted-foreground ml-1">from last month</span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
