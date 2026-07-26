import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AppWindow, Store, Users, Braces
} from "lucide-react";
import { useAuth } from "../auth-tenancy/AuthContext";
import { ConnectionsHub } from "./ConnectionsHub";
import { ShopProfilePage } from "./ShopProfilePage";
import { TeamMembersPage } from "../team/TeamMembersPage";
import { ProductFieldEditor } from "../inventory/ProductFieldEditor";

export type SettingsTab = "connections" | "team" | "profile" | "product-fields";

export function ConfigurationsPage() {
  const { user } = useAuth();
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("connections");
  const canViewTeam = user?.role === "OWNER" || user?.role === "MANAGER";

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pt-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ backgroundColor: 'rgba(212, 168, 67, 0.12)', color: 'var(--brand-saffron)' }}>
              Control Panel
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
            Settings
          </h1>
          <p className="font-medium text-lg" style={{ color: 'var(--text-secondary)' }}>
            Manage channels, team, automation, and your shop profile.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b mb-8 mt-2 overflow-x-auto" style={{ borderColor: 'var(--app-border)' }}>
        <button
          onClick={() => setActiveSettingsTab("connections")}
          className={`pb-4 px-6 font-bold text-sm tracking-tight relative transition-all duration-200 cursor-pointer whitespace-nowrap`}
          style={{ color: activeSettingsTab === "connections" ? 'var(--brand-saffron)' : 'var(--text-secondary)' }}
        >
          <div className="flex items-center gap-2">
            <AppWindow className="h-4.5 w-4.5" />
            <span>Connections Hub</span>
          </div>
          {activeSettingsTab === "connections" && (
            <motion.div
              layoutId="settingsTabUnderline"
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: 'var(--brand-saffron)' }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
        </button>
        {canViewTeam && (
          <button
            onClick={() => setActiveSettingsTab("team")}
            className={`pb-4 px-6 font-bold text-sm tracking-tight relative transition-all duration-200 cursor-pointer whitespace-nowrap`}
            style={{ color: activeSettingsTab === "team" ? 'var(--brand-saffron)' : 'var(--text-secondary)' }}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4.5 w-4.5" />
              <span>Team Members</span>
            </div>
            {activeSettingsTab === "team" && (
              <motion.div
                layoutId="settingsTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: 'var(--brand-saffron)' }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        )}

        <button
          onClick={() => setActiveSettingsTab("profile")}
          className={`pb-4 px-6 font-bold text-sm tracking-tight relative transition-all duration-200 cursor-pointer whitespace-nowrap`}
          style={{ color: activeSettingsTab === "profile" ? 'var(--brand-saffron)' : 'var(--text-secondary)' }}
        >
          <div className="flex items-center gap-2">
            <Store className="h-4.5 w-4.5" />
            <span>Shop Profile</span>
          </div>
          {activeSettingsTab === "profile" && (
            <motion.div
              layoutId="settingsTabUnderline"
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: 'var(--brand-saffron)' }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          onClick={() => setActiveSettingsTab("product-fields")}
          className={`pb-4 px-6 font-bold text-sm tracking-tight relative transition-all duration-200 cursor-pointer whitespace-nowrap`}
          style={{ color: activeSettingsTab === "product-fields" ? 'var(--brand-saffron)' : 'var(--text-secondary)' }}
        >
          <div className="flex items-center gap-2">
            <Braces className="h-4.5 w-4.5" />
            <span>Product Fields</span>
          </div>
          {activeSettingsTab === "product-fields" && (
            <motion.div
              layoutId="settingsTabUnderline"
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: 'var(--brand-saffron)' }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSettingsTab === "connections" && (
          <motion.div
            key="connections"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <ConnectionsHub />
          </motion.div>
        )}
        {activeSettingsTab === "team" && canViewTeam && (
          <motion.div
            key="team"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <TeamMembersPage />
          </motion.div>
        )}
        {activeSettingsTab === "profile" && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <ShopProfilePage />
          </motion.div>
        )}
        {activeSettingsTab === "product-fields" && (
          <motion.div
            key="product-fields"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <ProductFieldEditor />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}