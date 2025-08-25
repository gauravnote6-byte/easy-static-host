import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AzureDevOpsDefect {
  id: number;
  fields: {
    'System.Title': string;
    'System.Description'?: string;
    'System.WorkItemType': string;
    'Microsoft.VSTS.Common.Priority'?: number;
    'Microsoft.VSTS.Common.Severity'?: string;
    'System.State': string;
    'System.CreatedDate': string;
    'System.ClosedDate'?: string;
    'Microsoft.VSTS.Common.ResolvedReason'?: string;
    'System.AssignedTo'?: { displayName: string };
    'Microsoft.VSTS.TCM.ReproSteps'?: string;
  };
}

serve(async (req) => {
  console.log('Azure DevOps defects function called');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body, null, 2));

    const { organizationUrl, projectName, personalAccessToken } = body;

    // Input validation
    if (!organizationUrl || !projectName || !personalAccessToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: organizationUrl, projectName, and personalAccessToken are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate URL format
    try {
      new URL(organizationUrl);
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid organization URL format' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Construct Azure DevOps API URL for defects using WIQL
    const baseUrl = organizationUrl.endsWith('/') ? organizationUrl.slice(0, -1) : organizationUrl;
    const wiqlUrl = `${baseUrl}/_apis/wit/wiql?api-version=7.1`;

    console.log('Fetching defects from Azure DevOps WIQL API:', wiqlUrl);

    // Prepare authentication
    const authToken = btoa(`:${personalAccessToken}`);

    // WIQL query to get Bugs/Defects for the specific project
    const wiqlQuery = {
      query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${projectName}' AND [System.WorkItemType] = 'Bug' ORDER BY [System.CreatedDate] DESC`
    };

    // First, get work item IDs using WIQL
    const wiqlResponse = await fetch(wiqlUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(wiqlQuery),
    });

    console.log('Azure DevOps WIQL response status:', wiqlResponse.status);

    if (!wiqlResponse.ok) {
      const errorText = await wiqlResponse.text();
      console.error('Azure DevOps WIQL error:', errorText);
      
      if (wiqlResponse.status === 401) {
        throw new Error('Authentication failed. Please check your Personal Access Token.');
      } else if (wiqlResponse.status === 404) {
        throw new Error('Project not found. Please check your organization URL and project name.');
      } else {
        throw new Error(`Azure DevOps WIQL API error: ${wiqlResponse.status} ${wiqlResponse.statusText}`);
      }
    }

    let wiqlData;
    try {
      const responseText = await wiqlResponse.text();
      console.log('WIQL response text (first 200 chars):', responseText.substring(0, 200));
      
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        throw new Error('Received HTML response instead of JSON. Check authentication and URL.');
      }
      
      wiqlData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse WIQL response:', parseError);
      throw new Error('Invalid response from Azure DevOps API. Please check your credentials and URL.');
    }

    console.log('WIQL response:', { defectCount: wiqlData.workItems?.length || 0 });

    if (!wiqlData.workItems || wiqlData.workItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          defects: [],
          metrics: {
            totalDefects: 0,
            openDefects: 0,
            closedDefects: 0,
            criticalDefects: 0,
            highDefects: 0,
            mediumDefects: 0,
            lowDefects: 0
          },
          message: 'No defects found in the specified project'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get work item IDs
    const workItemIds = wiqlData.workItems.map((item: any) => item.id);
    const idsParam = workItemIds.join(',');
    
    // Now get the full defect details
    const workItemsUrl = `${baseUrl}/_apis/wit/workitems?ids=${idsParam}&$expand=Fields&api-version=7.1`;
    console.log('Fetching defect details:', workItemsUrl);

    const response = await fetch(workItemsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('Azure DevOps defects response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure DevOps defects error:', errorText);
      throw new Error(`Azure DevOps API error: ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      const responseText = await response.text();
      console.log('Defects response text (first 200 chars):', responseText.substring(0, 200));
      
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        throw new Error('Received HTML response instead of JSON. Check authentication and URL.');
      }
      
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse defects response:', parseError);
      throw new Error('Invalid response from Azure DevOps API. Please check your credentials and URL.');
    }

    console.log('Azure DevOps defects API response:', { count: data.count, hasValue: !!data.value });

    // Transform defects
    const defects = data.value?.map((workItem: AzureDevOpsDefect) => ({
      id: workItem.id.toString(),
      title: workItem.fields['System.Title'] || 'Untitled Defect',
      description: workItem.fields['System.Description'] || 'No description available',
      priority: workItem.fields['Microsoft.VSTS.Common.Priority'] ? 
        workItem.fields['Microsoft.VSTS.Common.Priority'] === 1 ? 'high' :
        workItem.fields['Microsoft.VSTS.Common.Priority'] === 2 ? 'medium' :
        workItem.fields['Microsoft.VSTS.Common.Priority'] === 3 ? 'low' : 'medium'
        : 'medium',
      severity: workItem.fields['Microsoft.VSTS.Common.Severity'] || 'Medium',
      state: workItem.fields['System.State'] || 'New',
      createdDate: workItem.fields['System.CreatedDate'],
      closedDate: workItem.fields['System.ClosedDate'],
      resolvedReason: workItem.fields['Microsoft.VSTS.Common.ResolvedReason'],
      assignedTo: workItem.fields['System.AssignedTo']?.displayName || 'Unassigned',
      reproSteps: workItem.fields['Microsoft.VSTS.TCM.ReproSteps'] || '',
      azureDevOpsId: workItem.id,
      source: 'azure-devops'
    })) || [];

    // Calculate metrics
    const totalDefects = defects.length;
    const openDefects = defects.filter(d => ['New', 'Active', 'Committed'].includes(d.state)).length;
    const closedDefects = defects.filter(d => ['Closed', 'Resolved', 'Done'].includes(d.state)).length;
    const criticalDefects = defects.filter(d => d.severity === 'Critical').length;
    const highDefects = defects.filter(d => d.priority === 'high' || d.severity === 'High').length;
    const mediumDefects = defects.filter(d => d.priority === 'medium' || d.severity === 'Medium').length;
    const lowDefects = defects.filter(d => d.priority === 'low' || d.severity === 'Low').length;

    const metrics = {
      totalDefects,
      openDefects,
      closedDefects,
      criticalDefects,
      highDefects,
      mediumDefects,
      lowDefects,
      defectClosureRate: totalDefects > 0 ? ((closedDefects / totalDefects) * 100).toFixed(1) : '0'
    };

    console.log('Defect metrics calculated:', metrics);

    return new Response(
      JSON.stringify({
        success: true,
        defects,
        metrics,
        message: `Successfully fetched ${defects.length} defects from Azure DevOps`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Azure DevOps defects error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred while fetching defects from Azure DevOps'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});