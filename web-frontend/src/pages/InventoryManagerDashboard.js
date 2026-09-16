import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext'; // ✅ Import your auth hook

export default function InventoryManagerDashboard() {
  const { user } = useAuth(); // ✅ Get the current logged-in user
  const isInventoryAdmin = user?.role === 'inventory_admin';

  const [inventoryItems, setInventoryItems] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [activeTab, setActiveTab] = useState('inbound'); // 'inbound' or 'store'
  
  // Search & Filter States
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('ALL');
  
  const [storeSearch, setStoreSearch] = useState('');
  const [storeCategoryFilter, setStoreCategoryFilter] = useState('ALL');

  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // ✅ If they are an inventory admin, only fetch inbound inventory to avoid 403 errors on the store endpoint
      if (isInventoryAdmin) {
        const invRes = await api.get('/api/inventory');
        setInventoryItems(invRes.data || []);
      } else {
        const [invRes, storeRes] = await Promise.all([
          api.get('/api/inventory'),
          api.get('/api/store/items')
        ]);
        setInventoryItems(invRes.data || []);
        setStoreItems(storeRes.data || []);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data.');
    }
  };

  // Filter Logic for Inbound Inventory
  const filteredInventory = inventoryItems.filter(item => {
    const matchesSearch = item.item_name?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                          item.category?.toLowerCase().includes(inventorySearch.toLowerCase());
    const matchesCategory = inventoryCategoryFilter === 'ALL' || item.category === inventoryCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter Logic for Store Equipment (Only calculated if allowed)
  const filteredStore = !isInventoryAdmin ? storeItems.filter(item => {
    const matchesSearch = item.item_name?.toLowerCase().includes(storeSearch.toLowerCase()) ||
                          item.serial_number?.toLowerCase().includes(storeSearch.toLowerCase());
    const matchesCategory = storeCategoryFilter === 'ALL' || item.category === storeCategoryFilter;
    return matchesSearch && matchesCategory;
  }) : [];

  const inboundCategories = ['ALL', ...new Set(inventoryItems.map(i => i.category))];
  const storeCategories = !isInventoryAdmin ? ['ALL', ...new Set(storeItems.map(i => i.category))] : [];

  return (
    <div className="p-6 bg-[#0f172a] min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {isInventoryAdmin ? 'Inventory Admin Control Center' : 'Inventory Manager Control Center'}
          </h1>
          <p className="text-gray-400 text-sm">
            {isInventoryAdmin 
              ? 'Overseeing inbound logistics, stock levels, and consumable inventory items.' 
              : 'Overseeing inbound logistics, stock levels, and physical store custody tracking.'}
          </p>
        </div>

        {/* Tab Switcher - Hidden for Inventory Admin */}
        {!isInventoryAdmin && (
          <div className="flex gap-2 bg-slate-900 p-1 rounded border border-slate-800">
            <button 
              onClick={() => setActiveTab('inbound')}
              className={`px-4 py-2 rounded text-xs font-medium transition ${activeTab === 'inbound' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              Inbound Inventory ({inventoryItems.length})
            </button>
            <button 
              onClick={() => setActiveTab('store')}
              className={`px-4 py-2 rounded text-xs font-medium transition ${activeTab === 'store' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              Physical Store Assets ({storeItems.length})
            </button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">{error}</div>}

      {/* Metrics Row - Dynamically adjusted based on role */}
      <div className={`grid grid-cols-1 ${isInventoryAdmin ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 mb-6`}>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <p className="text-xs text-gray-400 uppercase font-medium">Total Inbound Line Items</p>
          <h3 className="text-2xl font-bold mt-1 text-blue-400">{inventoryItems.length}</h3>
        </div>

        {!isInventoryAdmin && (
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
            <p className="text-xs text-gray-400 uppercase font-medium">Tracked Store Equipment</p>
            <h3 className="text-2xl font-bold mt-1 text-emerald-400">{storeItems.length}</h3>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <p className="text-xs text-gray-400 uppercase font-medium">Low Stock / Attention Needed</p>
          <h3 className="text-2xl font-bold mt-1 text-amber-400">
            {inventoryItems.filter(i => (i.in_stock || i.available_units || 0) <= (i.min_level || 5)).length}
          </h3>
        </div>
      </div>

      {/* INBOUND INVENTORY SECTION (Always shown to Inventory Admin, or when tab is active for managers) */}
      {(isInventoryAdmin || activeTab === 'inbound') && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <input 
              type="text"
              placeholder="Search inbound inventory by name or category..."
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-4 py-2 text-sm flex-1 focus:outline-none focus:border-blue-500 text-white"
            />
            <select 
              value={inventoryCategoryFilter}
              onChange={(e) => setInventoryCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              {inboundCategories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-800 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="p-4">Item Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Branch / Location</th>
                  <th className="p-4">Stock Level</th>
                  <th className="p-4">Min Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredInventory.length === 0 ? (
                  <tr><td colSpan="5" className="p-6 text-center text-gray-500">No inbound inventory items match your search.</td></tr>
                ) : (
                  filteredInventory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-4 font-medium">{item.item_name}</td>
                      <td className="p-4 text-gray-300">{item.category}</td>
                      <td className="p-4 text-gray-400">{item.branch || 'HQ / General'}</td>
                      <td className="p-4 font-semibold text-blue-400">{item.in_stock || 0}</td>
                      <td className="p-4 text-gray-400">{item.min_level || 5}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STORE EQUIPMENT SECTION (Restricted: only shown if NOT an inventory admin and store tab is active) */}
      {!isInventoryAdmin && activeTab === 'store' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <input 
              type="text"
              placeholder="Search store equipment by name or serial number..."
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-4 py-2 text-sm flex-1 focus:outline-none focus:border-blue-500 text-white"
            />
            <select 
              value={storeCategoryFilter}
              onChange={(e) => setStoreCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              {storeCategories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-800 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="p-4">Equipment Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Serial Number</th>
                  <th className="p-4">Available / Total Units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredStore.length === 0 ? (
                  <tr><td colSpan="4" className="p-6 text-center text-gray-500">No store equipment matches your search.</td></tr>
                ) : (
                  filteredStore.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-4 font-medium">{item.item_name}</td>
                      <td className="p-4 text-gray-300">{item.category}</td>
                      <td className="p-4 text-gray-400 font-mono text-xs">{item.serial_number || 'N/A'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${item.available_units > 0 ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
                          {item.available_units} / {item.total_units} Available
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}