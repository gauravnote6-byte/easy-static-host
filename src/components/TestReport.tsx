import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun } from "docx";
import html2canvas from "html2canvas";
import { 
  FileText, 
  Download, 
  Loader2, 
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Bug,
  Shield,
  TrendingUp
} from "lucide-react";

interface TestReportProps {
  projectId: string;
}

interface TestCase {
  id: string;
  title: string;
  status: 'passed' | 'failed' | 'blocked' | 'pending';
  priority: 'low' | 'medium' | 'high';
  userStoryTitle?: string;
}

export const TestReport = ({ projectId }: TestReportProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingDefects, setLoadingDefects] = useState(false);
  const [testReport, setTestReport] = useState<string>("");
  const [statistics, setStatistics] = useState<any>(null);
  const [projectName, setProjectName] = useState("");
  const [reportType, setReportType] = useState("executive");
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [includeDefects, setIncludeDefects] = useState(false);
  const [azureDevOpsData, setAzureDevOpsData] = useState<any>(null);
  const { toast } = useToast();

  // Chart refs for capturing images
  const statusChartRef = useRef<HTMLDivElement>(null);
  const priorityChartRef = useRef<HTMLDivElement>(null);
  const defectChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadTestCases = async () => {
      try {
        const { data: testCasesData, error } = await supabase
          .from('test_cases')
          .select('id, title, status, priority, steps, description, expected_result')
          .eq('project_id', projectId);
        
        if (error) {
          console.error('Error loading test cases:', error);
          toast({
            title: "Error",
            description: "Failed to load test cases from database",
            variant: "destructive",
          });
          return;
        }

        if (testCasesData) {
          // Cast the database data to match our interface
          const formattedTestCases: TestCase[] = testCasesData.map(tc => ({
            id: tc.id,
            title: tc.title,
            status: tc.status as 'passed' | 'failed' | 'blocked' | 'pending',
            priority: tc.priority as 'low' | 'medium' | 'high',
            userStoryTitle: undefined // Will be populated later if needed
          }));
          setTestCases(formattedTestCases);
        }
      } catch (error) {
        console.error('Error loading test cases:', error);
        toast({
          title: "Error", 
          description: "Failed to load test cases from database",
          variant: "destructive",
        });
      }
    };
    
    loadTestCases();
  }, [projectId, toast]);

  const fetchAzureDevOpsDefects = async () => {
    // Check if Azure DevOps integration is configured from the integrations module
    const savedConfigs = localStorage.getItem('integration-configs');
    console.log('Debug: savedConfigs raw:', savedConfigs);
    
    if (!savedConfigs) {
      console.log('Debug: No saved configs found');
      toast({
        title: "Integration Not Configured",
        description: "Please configure Azure DevOps integration in the Integrations module first.",
        variant: "destructive",
      });
      return;
    }

    const configs = JSON.parse(savedConfigs);
    console.log('Debug: parsed configs:', configs);
    const azureConfig = configs['azure-devops'];
    console.log('Debug: azureConfig:', azureConfig);
    
    if (!azureConfig || !azureConfig.enabled || !azureConfig.organizationUrl || !azureConfig.projectName || !azureConfig.personalAccessToken) {
      toast({
        title: "Integration Not Configured",
        description: "Please configure Azure DevOps integration in the Integrations module first.",
        variant: "destructive",
      });
      return;
    }

    setLoadingDefects(true);

    try {
      const { data, error } = await supabase.functions.invoke('azure-devops-defects', {
        body: {
          organizationUrl: azureConfig.organizationUrl,
          projectName: azureConfig.projectName,
          personalAccessToken: azureConfig.personalAccessToken
        }
      });

      if (error) throw error;

      if (data.success) {
        setAzureDevOpsData(data);
        toast({
          title: "Defects Loaded",
          description: `Loaded ${data.defects.length} defects from Azure DevOps`,
        });
      } else {
        throw new Error(data.error || 'Failed to fetch defects');
      }
    } catch (error) {
      console.error('Error fetching Azure DevOps defects:', error);
      toast({
        title: "Error",
        description: "Failed to fetch defects from Azure DevOps",
        variant: "destructive",
      });
    } finally {
      setLoadingDefects(false);
    }
  };

  const generateTestReport = async () => {
    if (!projectName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a project name",
        variant: "destructive",
      });
      return;
    }

    if (testCases.length === 0) {
      toast({
        title: "Error", 
        description: "No test cases found. Please add test cases first.",
        variant: "destructive",
      });
      return;
    }

    // Load OpenAI configuration from integrations
    const savedConfigs = localStorage.getItem('integration-configs');
    if (!savedConfigs) {
      toast({
        title: "Error",
        description: "OpenAI integration not configured. Please configure it in the Integrations tab.",
        variant: "destructive",
      });
      return;
    }

    const configs = JSON.parse(savedConfigs);
    const openAIConfig = configs.openai;
    
    if (!openAIConfig || !openAIConfig.apiKey) {
      toast({
        title: "Error", 
        description: "OpenAI API key not found. Please configure OpenAI integration first.",
        variant: "destructive",
      });
      return;
    }

    // Convert endpoint to baseURL for Azure OpenAI compatibility
    if (openAIConfig.endpoint) {
      openAIConfig.baseURL = openAIConfig.endpoint;
    }

    setLoading(true);
    try {
      const reportData: any = {
        testCases,
        projectName,
        reportType,
        projectId,
        openAIConfig, // Pass the OpenAI config
        testExecutionData: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        }
      };

      // Include Azure DevOps defect data if available and enabled
      if (includeDefects && azureDevOpsData) {
        reportData.azureDevOpsData = azureDevOpsData;
      }

      const { data, error } = await supabase.functions.invoke('generate-test-report', {
        body: reportData
      });

      if (error) throw error;

      setTestReport(data.testReport);
      setStatistics(data.statistics);
      toast({
        title: "Success",
        description: "Test report generated successfully!",
      });
    } catch (error) {
      console.error('Error generating test report:', error);
      toast({
        title: "Error",
        description: "Failed to generate test report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTestReport = async () => {
    if (!testReport) return;
    
    let toastId: any;
    try {
      toastId = toast({
        title: "Generating Document",
        description: "Capturing charts and creating Word document...",
      });

      // Helper function to capture chart as image
      const captureChart = async (element: HTMLElement | null): Promise<Buffer | null> => {
        if (!element) {
          console.log('Element not found for chart capture');
          return null;
        }
        
        try {
          console.log('Capturing chart element:', element);
          const canvas = await html2canvas(element, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            height: element.offsetHeight,
            width: element.offsetWidth,
          });
          
          return new Promise((resolve, reject) => {
            try {
              canvas.toBlob((blob) => {
                if (blob) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    const arrayBuffer = reader.result as ArrayBuffer;
                    resolve(Buffer.from(arrayBuffer));
                  };
                  reader.onerror = () => reject(new Error('FileReader error'));
                  reader.readAsArrayBuffer(blob);
                } else {
                  console.warn('Canvas toBlob returned null');
                  resolve(null);
                }
              }, 'image/png');
            } catch (error) {
              console.error('Error in canvas.toBlob:', error);
              reject(error);
            }
          });
        } catch (error) {
          console.error('Error capturing chart:', error);
          return null;
        }
      };

      console.log('Starting chart capture...');
      // Capture chart images with timeout
      const captureWithTimeout = (promise: Promise<Buffer | null>, timeout: number = 10000) => {
        return Promise.race([
          promise,
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Chart capture timeout')), timeout)
          )
        ]);
      };

      const statusChartImage = await captureWithTimeout(captureChart(statusChartRef.current));
      const priorityChartImage = await captureWithTimeout(captureChart(priorityChartRef.current));
      const defectChartImage = azureDevOpsData ? await captureWithTimeout(captureChart(defectChartRef.current)) : null;
      
      console.log('Chart capture completed:', {
        statusChart: !!statusChartImage,
        priorityChart: !!priorityChartImage,
        defectChart: !!defectChartImage
      });

      // Create Word document
      const docChildren: any[] = [
        new Paragraph({
          children: [
            new TextRun({
              text: `${projectName || 'Project'} - Test Execution Report`,
              bold: true,
              size: 32,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated on: ${new Date().toLocaleDateString()}`,
              size: 24,
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        
        // Test Statistics Section
        new Paragraph({
          children: [
            new TextRun({
              text: "Test Execution Summary",
              bold: true,
              size: 28,
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        
        // Statistics Table
        new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("Metric")],
                }),
                new TableCell({
                  children: [new Paragraph("Value")],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("Total Test Cases")],
                }),
                new TableCell({
                  children: [new Paragraph(testCases.length.toString())],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("Passed")],
                }),
                new TableCell({
                  children: [new Paragraph(testCases.filter(tc => tc.status === 'passed').length.toString())],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("Failed")],
                }),
                new TableCell({
                  children: [new Paragraph(testCases.filter(tc => tc.status === 'failed').length.toString())],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("Blocked")],
                }),
                new TableCell({
                  children: [new Paragraph(testCases.filter(tc => tc.status === 'blocked').length.toString())],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("Pending")],
                }),
                new TableCell({
                  children: [new Paragraph(testCases.filter(tc => tc.status === 'pending').length.toString())],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("Pass Rate")],
                }),
                new TableCell({
                  children: [new Paragraph(`${testCases.length > 0 ? Math.round((testCases.filter(tc => tc.status === 'passed').length / testCases.length) * 100) : 0}%`)],
                }),
              ],
            }),
          ],
        }),
        
        new Paragraph({ text: "" }),
        new Paragraph({ text: "" }),
      ];

      // Add Test Status Distribution Chart
      if (statusChartImage) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Test Status Distribution",
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new ImageRun({
                data: statusChartImage,
                transformation: {
                  width: 400,
                  height: 300,
                },
                type: "png",
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" })
        );
      }

      // Add Test Priority Distribution Chart
      if (priorityChartImage) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Test Priority Distribution",
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new ImageRun({
                data: priorityChartImage,
                transformation: {
                  width: 400,
                  height: 300,
                },
                type: "png",
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" })
        );
      }

      // Add Defect Analysis if available
      if (azureDevOpsData) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Defect Analysis",
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Defect Metric")],
                  }),
                  new TableCell({
                    children: [new Paragraph("Value")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Total Defects")],
                  }),
                  new TableCell({
                    children: [new Paragraph(azureDevOpsData.metrics.totalDefects.toString())],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Open Defects")],
                  }),
                  new TableCell({
                    children: [new Paragraph(azureDevOpsData.metrics.openDefects.toString())],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Critical Defects")],
                  }),
                  new TableCell({
                    children: [new Paragraph(azureDevOpsData.metrics.criticalDefects.toString())],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Closure Rate")],
                  }),
                  new TableCell({
                    children: [new Paragraph(`${azureDevOpsData.metrics.defectClosureRate}%`)],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" })
        );

        // Add Defect Status Chart if available
        if (defectChartImage) {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "Defect Status Distribution",
                  bold: true,
                  size: 28,
                }),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: defectChartImage,
                  transformation: {
                    width: 400,
                    height: 300,
                  },
                  type: "png",
                }),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" })
          );
        }
      }

      // Add AI Generated Report Content
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Detailed Analysis",
              bold: true,
              size: 28,
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        ...testReport.split('\n').map(line => 
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 24,
              }),
            ],
          })
        )
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: docChildren,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName || 'project'}-test-report.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Test report with charts downloaded as Word document",
      });
    } catch (error) {
      console.error('Error creating Word document:', error);
      toast({
        title: "Error",
        description: "Failed to create Word document. Downloading as text instead.",
        variant: "destructive",
      });
      
      // Fallback to text download
      const blob = new Blob([testReport], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName || 'project'}-test-report.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'blocked': return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'pending': return <Clock className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-success';
      case 'failed': return 'text-destructive';
      case 'blocked': return 'text-warning';
      case 'pending': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  // Chart data preparation
  const testStatusData = [
    { name: 'Passed', value: testCases.filter(tc => tc.status === 'passed').length, color: 'hsl(var(--success))' },
    { name: 'Failed', value: testCases.filter(tc => tc.status === 'failed').length, color: 'hsl(var(--destructive))' },
    { name: 'Blocked', value: testCases.filter(tc => tc.status === 'blocked').length, color: 'hsl(var(--warning))' },
    { name: 'Pending', value: testCases.filter(tc => tc.status === 'pending').length, color: 'hsl(var(--muted-foreground))' },
  ].filter(item => item.value > 0);

  const priorityData = [
    { name: 'High', value: testCases.filter(tc => tc.priority === 'high').length },
    { name: 'Medium', value: testCases.filter(tc => tc.priority === 'medium').length },
    { name: 'Low', value: testCases.filter(tc => tc.priority === 'low').length },
  ].filter(item => item.value > 0);

  const defectData = azureDevOpsData ? [
    { name: 'Open', value: azureDevOpsData.metrics.openDefects },
    { name: 'Closed', value: azureDevOpsData.metrics.totalDefects - azureDevOpsData.metrics.openDefects },
  ] : [];

  const chartConfig = {
    passed: { label: "Passed", color: "hsl(var(--success))" },
    failed: { label: "Failed", color: "hsl(var(--destructive))" },
    blocked: { label: "Blocked", color: "hsl(var(--warning))" },
    pending: { label: "Pending", color: "hsl(var(--muted-foreground))" },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Test Report Generator</h2>
          <p className="text-muted-foreground">
            Generate comprehensive test execution reports
          </p>
        </div>
      </div>

      {/* Test Statistics Overview */}
      {testCases.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Total Tests</p>
                  <p className="text-2xl font-bold">{testCases.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <div>
                  <p className="text-sm font-medium">Passed</p>
                  <p className="text-2xl font-bold">{testCases.filter(tc => tc.status === 'passed').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-sm font-medium">Failed</p>
                  <p className="text-2xl font-bold">{testCases.filter(tc => tc.status === 'failed').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-sm font-medium">Pass Rate</p>
                  <p className="text-2xl font-bold">
                    {testCases.length > 0 ? Math.round((testCases.filter(tc => tc.status === 'passed').length / testCases.length) * 100) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Azure DevOps Defect Metrics */}
      {azureDevOpsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-sm font-medium">Total Defects</p>
                  <p className="text-2xl font-bold">{azureDevOpsData.metrics.totalDefects}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                <div>
                  <p className="text-sm font-medium">Open Defects</p>
                  <p className="text-2xl font-bold">{azureDevOpsData.metrics.openDefects}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-sm font-medium">Critical</p>
                  <p className="text-2xl font-bold">{azureDevOpsData.metrics.criticalDefects}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <div>
                  <p className="text-sm font-medium">Closure Rate</p>
                  <p className="text-2xl font-bold">{azureDevOpsData.metrics.defectClosureRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      {testCases.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Test Status Distribution Chart */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Test Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div ref={statusChartRef} className="w-full h-[250px] sm:h-[300px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={testStatusData}
                          cx="50%"
                          cy="50%"
                          outerRadius="70%"
                          dataKey="value"
                          label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {testStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            {/* Test Priority Distribution Chart */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Test Priority Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div ref={priorityChartRef} className="w-full h-[250px] sm:h-[300px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={priorityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar 
                          dataKey="value" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Defect Status Chart (if Azure DevOps data available) */}
          {azureDevOpsData && defectData.length > 0 && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5 text-primary" />
                  Defect Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div ref={defectChartRef} className="w-full h-[250px] sm:h-[300px] flex justify-center">
                  <div className="w-full max-w-md">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={defectData}
                            cx="50%"
                            cy="50%"
                            outerRadius="80%"
                            dataKey="value"
                            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            <Cell fill="hsl(var(--destructive))" />
                            <Cell fill="hsl(var(--success))" />
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Configuration */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                placeholder="Enter project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">Executive Summary</SelectItem>
                  <SelectItem value="detailed">Detailed Analysis</SelectItem>
                  <SelectItem value="stakeholder">Stakeholder Report</SelectItem>
                  <SelectItem value="technical">Technical Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Azure DevOps Integration</Label>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-primary" />
                <span className="text-sm">Include defect metrics in report</span>
              </div>
              <div className="flex items-center gap-2">
                 <Switch
                   checked={includeDefects}
                   onCheckedChange={setIncludeDefects}
                 />
                 {!azureDevOpsData && includeDefects && (
                   <div className="space-y-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={fetchAzureDevOpsDefects}
                       disabled={loadingDefects}
                     >
                       {loadingDefects ? (
                         <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                       ) : (
                         <Bug className="mr-1 h-3 w-3" />
                       )}
                       Load Defects from Integration
                     </Button>
                     <p className="text-xs text-muted-foreground">
                       Configure Azure DevOps integration in the Integrations module first
                     </p>
                   </div>
                 )}
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Test Cases Status Overview</Label>
            <div className="flex flex-wrap gap-2">
              {['passed', 'failed', 'blocked', 'pending'].map(status => {
                const count = testCases.filter(tc => tc.status === status).length;
                return (
                  <Badge key={status} variant="outline" className={`text-xs ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                    <span className="ml-1">{status}: {count}</span>
                  </Badge>
                );
              })}
            </div>
          </div>

          <Button 
            onClick={generateTestReport} 
            disabled={loading}
            className="w-full md:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Test Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Test Report */}
      {testReport && (
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Generated Test Report
              </CardTitle>
              <Button variant="outline" onClick={downloadTestReport}>
                <Download className="mr-2 h-4 w-4" />
                Download as Word Document
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {statistics && (
              <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-2">Quick Statistics</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>Total: <span className="font-bold">{statistics.totalTests}</span></div>
                  <div>Passed: <span className="font-bold text-success">{statistics.passedTests}</span></div>
                  <div>Failed: <span className="font-bold text-destructive">{statistics.failedTests}</span></div>
                  <div>Blocked: <span className="font-bold text-warning">{statistics.blockedTests}</span></div>
                  <div>Pass Rate: <span className="font-bold">{statistics.passRate}%</span></div>
                </div>
              </div>
            )}
            <div className="bg-muted/50 p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm font-mono overflow-auto max-h-96">
                {testReport}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};