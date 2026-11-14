import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/auth.store';
import Layout from './components/Layout';
import SuperAdminLayout from './components/SuperAdminLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ContactsPage from './pages/ContactsPage';
import ListsPage from './pages/ListsPage';
import CampaignsPage from './pages/CampaignsPage';
import TemplatesPage from './pages/TemplatesPage';
import TemplateEditorPage from './pages/TemplateEditorPage';
import AutomationsPage from './pages/AutomationsPage';
import AutomationEditorPage from './pages/AutomationEditorPage';
import SettingsPage from './pages/SettingsPage';
import ContactProfilePage from './pages/ContactProfilePage';
import SegmentsPage from './pages/SegmentsPage';
import LeadsPage from './pages/LeadsPage';
import CopilotPage from './pages/CopilotPage';
import CampaignAnalyticsPage from './pages/CampaignAnalyticsPage';
import CampaignComparePage from './pages/CampaignComparePage';
import TransactionalPage from './pages/TransactionalPage';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import TenantsListPage from './pages/super-admin/TenantsListPage';
import TenantDetailPage from './pages/super-admin/TenantDetailPage';
import PlansManagementPage from './pages/super-admin/PlansManagementPage';
import SuperAdminAuditPage from './pages/super-admin/SuperAdminAuditPage';
import ConfirmSubscriptionPage from './pages/ConfirmSubscriptionPage';
import PreferenceCenterPage from './pages/PreferenceCenterPage';
import SocialMediaPage from './pages/SocialMediaPage';
import SocialAccountsPage from './pages/SocialAccountsPage';
import SocialPostComposer from './pages/SocialPostComposer';
import SocialCalendarPage from './pages/SocialCalendarPage';
import WhatsAppDashboardPage from './pages/whatsapp/WhatsAppDashboardPage';
import WhatsAppAccountsPage from './pages/whatsapp/WhatsAppAccountsPage';
import WhatsAppInboxPage from './pages/whatsapp/WhatsAppInboxPage';
import WhatsAppCampaignsPage from './pages/whatsapp/WhatsAppCampaignsPage';
import WhatsAppCampaignDetailPage from './pages/whatsapp/WhatsAppCampaignDetailPage';
import WhatsAppTemplatesPage from './pages/whatsapp/WhatsAppTemplatesPage';
import WhatsAppAIPage from './pages/whatsapp/WhatsAppAIPage';
import EnquiriesPage from './pages/super-admin/EnquiriesPage';
import HomePage from './pages/site/HomePage';
import AboutPage from './pages/site/AboutPage';
import FeaturesPage from './pages/site/FeaturesPage';
import FeatureDetailPage from './pages/site/FeatureDetailPage';
import ContactPage from './pages/site/ContactPage';
import EnquiryPage from './pages/site/EnquiryPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isLoading || !user) return <LoadingScreen />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isLoading || !user) return <LoadingScreen />;
  if (!user.is_super_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LoginRedirect() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isLoading || !user) return <LoadingScreen />;
  if (user.is_super_admin && !user.org_id) return <Navigate to="/super-admin" replace />;
  return <Navigate to="/" replace />;
}

/** Visitors see the public website at "/"; signed-in users keep their dashboard there. */
function HomeRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <HomePage />;
  return (
    <ProtectedRoute>
      <Layout><DashboardPage /></Layout>
    </ProtectedRoute>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, loadUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) loadUser();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/features/:slug" element={<FeatureDetailPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/register" element={<EnquiryPage />} />
      <Route path="/signup" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/confirm/:token" element={<ConfirmSubscriptionPage />} />
      <Route path="/preferences/:token" element={<PreferenceCenterPage />} />
      <Route path="/login-redirect" element={<LoginRedirect />} />

      {/* Full-screen editors (no sidebar layout) */}
      <Route path="/templates/:id/edit" element={
        <ProtectedRoute><TemplateEditorPage /></ProtectedRoute>
      } />
      <Route path="/automations/:id/edit" element={
        <ProtectedRoute><AutomationEditorPage /></ProtectedRoute>
      } />

      {/* Super Admin Routes */}
      <Route path="/super-admin" element={
        <SuperAdminRoute>
          <SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>
        </SuperAdminRoute>
      } />
      <Route path="/super-admin/tenants" element={
        <SuperAdminRoute>
          <SuperAdminLayout><TenantsListPage /></SuperAdminLayout>
        </SuperAdminRoute>
      } />
      <Route path="/super-admin/tenants/:id" element={
        <SuperAdminRoute>
          <SuperAdminLayout><TenantDetailPage /></SuperAdminLayout>
        </SuperAdminRoute>
      } />
      <Route path="/super-admin/plans" element={
        <SuperAdminRoute>
          <SuperAdminLayout><PlansManagementPage /></SuperAdminLayout>
        </SuperAdminRoute>
      } />
      <Route path="/super-admin/enquiries" element={
        <SuperAdminRoute>
          <SuperAdminLayout><EnquiriesPage /></SuperAdminLayout>
        </SuperAdminRoute>
      } />
      <Route path="/super-admin/audit-logs" element={
        <SuperAdminRoute>
          <SuperAdminLayout><SuperAdminAuditPage /></SuperAdminLayout>
        </SuperAdminRoute>
      } />

      {/* Layout-wrapped tenant pages */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/copilot" element={<CopilotPage />} />
                <Route path="/leads" element={<LeadsPage />} />
                <Route path="/contacts" element={<ContactsPage />} />
                <Route path="/contacts/:id" element={<ContactProfilePage />} />
                <Route path="/lists" element={<ListsPage />} />
                <Route path="/campaigns" element={<CampaignsPage />} />
                <Route path="/campaigns/compare" element={<CampaignComparePage />} />
                <Route path="/campaigns/:id/analytics" element={<CampaignAnalyticsPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/automations" element={<AutomationsPage />} />
                <Route path="/segments" element={<SegmentsPage />} />
                <Route path="/transactional" element={<TransactionalPage />} />
                <Route path="/social" element={<SocialMediaPage />} />
                <Route path="/social/accounts" element={<SocialAccountsPage />} />
                <Route path="/social/compose" element={<SocialPostComposer />} />
                <Route path="/social/compose/:id" element={<SocialPostComposer />} />
                <Route path="/social/calendar" element={<SocialCalendarPage />} />
                <Route path="/whatsapp" element={<WhatsAppDashboardPage />} />
                <Route path="/whatsapp/inbox" element={<WhatsAppInboxPage />} />
                <Route path="/whatsapp/campaigns" element={<WhatsAppCampaignsPage />} />
                <Route path="/whatsapp/campaigns/:id" element={<WhatsAppCampaignDetailPage />} />
                <Route path="/whatsapp/templates" element={<WhatsAppTemplatesPage />} />
                <Route path="/whatsapp/accounts" element={<WhatsAppAccountsPage />} />
                <Route path="/whatsapp/ai" element={<WhatsAppAIPage />} />
                {/* <Route path="/forms" element={<SignupFormsPage />} /> Hidden — managed from super admin */}
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
