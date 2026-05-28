import { Store, Coffee, ShoppingBag, Briefcase, Zap } from 'lucide-react';

export type BusinessType = 'food' | 'retail' | 'electronics' | 'service' | 'other';

interface IndustryConfig {
    type: BusinessType;
    label: string;
    catalogTerm: string;
    catalogIcon: any;
    pipelineLabels: {
        new: string;
        processing: string;
        ready: string;
        logistics: string;
        completed: string;
        cancelled: string;
    };
    colors: {
        primary: string;
        badge: string;
    };
}

export const INDUSTRY_CONFIGS: Record<BusinessType, IndustryConfig> = {
    food: {
        type: 'food',
        label: 'Restaurant / Food',
        catalogTerm: 'Menu',
        catalogIcon: Coffee,
        pipelineLabels: {
            new: 'In Kitchen',
            processing: 'Cooking',
            ready: 'Ready for Pickup',
            logistics: 'Out for Delivery',
            completed: 'Served/Delivered',
            cancelled: 'Cancelled'
        },
        colors: {
            primary: 'orange-500',
            badge: 'bg-orange-100 text-orange-800'
        }
    },
    retail: {
        type: 'retail',
        label: 'Retail / Clothing',
        catalogTerm: 'Collection',
        catalogIcon: ShoppingBag,
        pipelineLabels: {
            new: 'New Order',
            processing: 'Packing',
            ready: 'Ready to Ship',
            logistics: 'In Transit',
            completed: 'Shipped',
            cancelled: 'Returned/Cancelled'
        },
        colors: {
            primary: 'blue-500',
            badge: 'bg-app-primary/10 text-app-primary'
        }
    },
    electronics: {
        type: 'electronics',
        label: 'Electronics / Tech',
        catalogTerm: 'Inventory',
        catalogIcon: Zap,
        pipelineLabels: {
            new: 'New Order',
            processing: 'Verifying',
            ready: 'Ready to Dispatch',
            logistics: 'Shipping',
            completed: 'Delivered',
            cancelled: 'Cancelled'
        },
        colors: {
            primary: 'purple-500',
            badge: 'bg-purple-100 text-purple-800'
        }
    },
    service: {
        type: 'service',
        label: 'Service / Agency',
        catalogTerm: 'Services',
        catalogIcon: Briefcase,
        pipelineLabels: {
            new: 'New Inquiry',
            processing: 'In Progress',
            ready: 'Review',
            logistics: 'Delivery',
            completed: 'Completed',
            cancelled: 'Cancelled'
        },
        colors: {
            primary: 'emerald-500',
            badge: 'bg-emerald-100 text-emerald-800'
        }
    },
    other: {
        type: 'other',
        label: 'General Business',
        catalogTerm: 'Catalog',
        catalogIcon: Store,
        pipelineLabels: {
            new: 'New',
            processing: 'Processing',
            ready: 'Ready',
            logistics: 'Logistics',
            completed: 'Completed',
            cancelled: 'Cancelled'
        },
        colors: {
            primary: 'gray-500',
            badge: 'bg-gray-100 text-gray-800'
        }
    }
};

export const getIndustryConfig = (businessTypeString?: string): IndustryConfig => {
    const type = (businessTypeString || "other").toLowerCase();

    if (type.match(/(restaurant|food|cafe|bakery|kitchen|dining)/)) return INDUSTRY_CONFIGS.food;
    if (type.match(/(retail|clothing|fashion|boutique|wear|store)/)) return INDUSTRY_CONFIGS.retail;
    if (type.match(/(electronics|tech|gadgets|computer|mobile)/)) return INDUSTRY_CONFIGS.electronics;
    if (type.match(/(service|consulting|agency|salon|spa|repair)/)) return INDUSTRY_CONFIGS.service;

    return INDUSTRY_CONFIGS.other;
};
