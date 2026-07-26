import React from 'react';
import { motion } from 'framer-motion';
import { CollectionStatsWidget } from './widgets/CollectionStatsWidget';
import { useShopDashboardData } from './hooks/useShopDashboardData';

export const MyShopPage: React.FC = () => {
  useShopDashboardData();

  return (
    <motion.div
      key="shop-tab"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="space-y-6"
    >
      <CollectionStatsWidget />
    </motion.div>
  );
};
