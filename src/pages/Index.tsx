import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Projects } from "@/components/Projects";
import { Dashboard } from "@/components/Dashboard";
import { UserStories } from "@/components/UserStories";
import { TestCases } from "@/components/TestCases";
import { TestPlan } from "@/components/TestPlan";
import { TestReport } from "@/components/TestReport";
import { Integrations } from "@/components/Integrations";
import { AIAnalytics } from "@/components/AIAnalytics";
import RoleManager from "@/components/RoleManager";

const Index = () => {
  const [currentView, setCurrentView] = useState('projects');
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);

  const handleProjectSelect = (projectId: string, projectName: string) => {
    setSelectedProject({ id: projectId, name: projectName });
    setCurrentView('dashboard');
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setCurrentView('projects');
  };

  const renderView = () => {
    if (currentView === 'projects') {
      return <Projects onProjectSelect={handleProjectSelect} />;
    }

    if (currentView === 'role-manager') {
      return <RoleManager />;
    }

    if (currentView === 'ai-analytics') {
      return <AIAnalytics />;
    }

    if (!selectedProject) {
      return <Projects onProjectSelect={handleProjectSelect} />;
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewChange={setCurrentView} projectId={selectedProject.id} />;
      case 'user-stories':
        return <UserStories onViewChange={setCurrentView} projectId={selectedProject.id} />;
      case 'test-cases':
        return <TestCases projectId={selectedProject.id} />;
      case 'test-plan':
        return <TestPlan projectId={selectedProject.id} />;
      case 'test-report':
        return <TestReport projectId={selectedProject.id} />;
      case 'integrations':
        return <Integrations />;
      default:
        return <Dashboard onViewChange={setCurrentView} projectId={selectedProject.id} />;
    }
  };

  return (
    <Layout 
      currentView={currentView} 
      onViewChange={setCurrentView}
      selectedProject={selectedProject}
      onBackToProjects={handleBackToProjects}
    >
      {renderView()}
    </Layout>
  );
};

export default Index;
