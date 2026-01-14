// web-frontend/src/pages/ResultsDashboardPage.js
import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, CircularProgress, Alert, List, ListItem, ListItemText } from '@mui/material';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

// (Optional) If you want to use a charting library later, you'd import it here, e.g.:
// import { BarChart } from '@mui/x-charts/BarChart';

function ResultsDashboardPage() {
    const { user, token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [summaryData, setSummaryData] = useState(null); // To store overview data
    const [recentResults, setRecentResults] = useState([]); // To store a list of recent results

    const API_BASE_URL = 'https://g2g-mri-erp-bfw57.ondigitalocean.app'; // Your backend URL

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user || !token) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Fetch summary data (e.g., total results, counts by status)
                // NOTE: You will need to add a backend endpoint for this data.
                // For now, this will likely fail or return mock data.
                const summaryResponse = await fetch(`${API_BASE_URL}/api/analytics/results-summary`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const summaryJson = await summaryResponse.json();
                if (summaryResponse.ok) {
                    setSummaryData(summaryJson);
                } else {
                    throw new Error(summaryJson.message || 'Failed to fetch results summary.');
                }

                // Fetch recent results
                // NOTE: You will need to add a backend endpoint for this data.
                // For now, this will likely fail or return mock data.
                const recentResponse = await fetch(`${API_BASE_URL}/api/analytics/recent-results`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const recentJson = await recentResponse.json();
                if (recentResponse.ok) {
                    setRecentResults(recentJson);
                } else {
                    throw new Error(recentJson.message || 'Failed to fetch recent results.');
                }

            } catch (err) {
                console.error('Error fetching results dashboard data:', err);
                setError(err.message || 'An error occurred while loading dashboard data.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
        // Optionally, set an interval for real-time updates for dashboard if needed
        // const interval = setInterval(fetchDashboardData, 30000); // e.g., every 30 seconds
        // return () => clearInterval(interval); // Cleanup
    }, [user, token]);


    return (
        <Layout>
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Results Dashboard
                </Typography>

                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : (
                    <Grid container spacing={3}>
                        {/* Summary Cards */}
                        <Grid item xs={12} sm={4}>
                            <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h5" color="primary">Total Results</Typography>
                                <Typography variant="h4">{summaryData?.total_results || 0}</Typography>
                            </Paper>
                        </Grid>
                        {/* <Grid item xs={12} sm={4}>
                            <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h5" color="text.secondary">Pending Review</Typography>
                                <Typography variant="h4">{summaryData?.pending_results || 0}</Typography>
                            </Paper>
                        </Grid> */}
                        <Grid item xs={12} sm={4}>
                            <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h5" color="success.main">Issued Results</Typography>
                                <Typography variant="h4">{summaryData?.issued_results || 0}</Typography>
                            </Paper>
                        </Grid>

                        {/* Recent Results List */}
                        <Grid item xs={12}>
                            <Paper elevation={3} sx={{ p: 2 }}>
                                <Typography variant="h5" gutterBottom>Recent Result Uploads</Typography>
                                {recentResults.length === 0 ? (
                                    <Typography variant="body1" color="text.secondary">No recent results found.</Typography>
                                ) : (
                                    <List>
                                        {recentResults.map((result) => (
                                            <ListItem key={result.id} secondaryAction={
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(result.created_at).toLocaleDateString()}
                                                </Typography>
                                            }>
                                                <ListItemText
                                                    primary={`Patient: ${result.patient_name || 'N/A'} - ${result.file_name}`}
                                                    secondary={`Status: ${result.result_status} | Uploaded by: ${result.uploaded_by_name || 'Unknown'}`}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                )}
                            </Paper>
                        </Grid>

                        {/* (Optional) Add more sections for charts, other widgets here */}
                        {/* Example of a placeholder for a chart:
                        <Grid item xs={12}>
                            <Paper elevation={3} sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom>Results by Type (Placeholder Chart)</Typography>
                                <Box sx={{ height: 300, width: '100%' }}>
                                    <BarChart
                                        // chart data and props here
                                    />
                                </Box>
                            </Paper>
                        </Grid>
                        */}
                    </Grid>
                )}
            </Box>
        </Layout>
    );
}

export default ResultsDashboardPage;