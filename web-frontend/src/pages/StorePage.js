// web-frontend/src/pages/StorePage.js
import React, { useState, useEffect } from 'react';
import { 
  Package, Wrench, ArrowUpRight, ArrowDownLeft, Search, 
  Filter, Plus, ShieldCheck, AlertCircle, Clock, CheckCircle2 
} from 'lucide-react';
import api from '../services/api';

export default function StorePage() {
  const [storeItems, setStoreItems] = useState([]);
  const [storeLogs, setStoreLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' or 'logs'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog States
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openCheckoutModal, setOpenCheckoutModal] = useState(false);
  const [openReturnModal, setOpenReturnModal] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedLogId, setSelectedLogId] = useState(null);

  // Form States
  const [newItem, setNewItem] = useState({ item_name: '', category: '', serial_number: '', total_units: 1 });
  const [checkoutData, setCheckoutData] = useState({ borrower_name: '', borrower_id_or_staff: '', checkout_condition: '', notes: '' });
  const [returnData, setReturnData] = useState({ return_condition: '', notes: '' });

  useEffect(() => {
    fetchStoreData();
  }, []);

  const fetchStoreData = async () => {
    try {
      const [itemsRes, logsRes] = await Promise.all([
        api.get('/api/store/items'),
        api.get('/api/store/logs')
      ]);
      setStoreItems(itemsRes.data || []);
      setStoreLogs(logsRes.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching store data:', err);
      setError('Failed to load store inventory from server.');
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/store/items', newItem);
      setSuccess('Store equipment added successfully.');
      setOpenAddModal(false);
      setNewItem({ item_name: '', category: '', serial_number: '', total_units: 1 });
      fetchStoreData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add store item.');
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/store/checkout', {
        store_item_id: selectedItem.id,
        ...checkoutData
      });
      setSuccess('Item checked out / rented successfully.');
      setOpenCheckoutModal(false);
      setCheckoutData({ borrower_name: '', borrower_id_or_staff: '', checkout_condition: '', notes: '' });
      fetchStoreData();
    } catch (err) {
      setError(err.response?.data?.message || 'Checkout failed.');
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/store/return', {
        log_id: selectedLogId,
        ...returnData
      });
      setSuccess('Item returned successfully with condition review logged.');
      setOpenReturnModal(false);
      setReturnData({ return_condition: '', notes: '' });
      fetchStoreData();
    } catch (err) {
      setError(err.response?.data?.message || 'Return process failed.');
    }
  };

  // Filter and search logic
  const filteredItems = storeItems.filter(item => {
    const matchesSearch = item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.serial_number && item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...new Set(storeItems.map(i => i.category))];
  const activeCheckoutsCount = storeLogs.filter(l => l.status === 'CHECKED_OUT').length;

  return (
    <div className="p-8 bg-[#0b1329] min-h-screen text-slate-100">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Package size={22} />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">Physical Store & Equipment Custody</h1>
          </div>
          <p className="text-slate-400 text-sm">Track physical tools, equipment deployments, condition audits, and active checkouts.</p>
        </div>
        
        <button 
          onClick={() => setOpenAddModal(true)} 
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/20 transition duration-200">
          <Plus size={18} /> Add Equipment
        </button>
      </div>

      {/* Notifications Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-950/60 border border-red-500/50 rounded-xl text-red-200 text-sm flex items-center gap-3 backdrop-blur-md">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-200 text-sm flex items-center gap-3 backdrop-blur-md">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Modern Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6 mb-6">
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`pb-4 px-2 font-semibold text-sm border-b-2 transition flex items-center gap-2 ${activeTab === 'inventory' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          <Package size={16} /> Store Equipment Inventory ({storeItems.length})
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`pb-4 px-2 font-semibold text-sm border-b-2 transition flex items-center gap-2 ${activeTab === 'logs' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          <Clock size={16} /> Custody Logs 
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeCheckoutsCount > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
            {activeCheckoutsCount} Active
          </span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by equipment name or serial number..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder-slate-500 shadow-inner"
          />
        </div>
        
        {activeTab === 'inventory' && (
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-8 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 appearance-none shadow-inner">
              {categories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat.toUpperCase()}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab Content 1: Equipment Inventory Table */}
      {activeTab === 'inventory' && (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
              <tr>
                <th className="p-4.5">Equipment Name</th>
                <th className="p-4.5">Category</th>
                <th className="p-4.5">Serial Number</th>
                <th className="p-4.5">Availability Status</th>
                <th className="p-4.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">
                    No store inventory items match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-4.5 font-medium text-slate-200">{item.item_name}</td>
                    <td className="p-4.5 text-slate-300">
                      <span className="px-2.5 py-1 bg-slate-800 border border-slate-700/60 rounded-lg text-xs font-medium text-slate-300">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-4.5 text-slate-400 font-mono text-xs">{item.serial_number || 'N/A'}</td>
                    <td className="p-4.5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${item.available_units > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.available_units > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                        {item.available_units} / {item.total_units} Available
                      </span>
                    </td>
                    <td className="p-4.5 text-right">
                      <button 
                        disabled={item.available_units <= 0}
                        onClick={() => { setSelectedItem(item); setOpenCheckoutModal(true); }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${item.available_units > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}>
                        Check Out / Rent
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content 2: Custody Logs Table */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
              <tr>
                <th className="p-4.5">Equipment</th>
                <th className="p-4.5">Borrower / Staff</th>
                <th className="p-4.5">Checkout Condition</th>
                <th className="p-4.5">Return Condition</th>
                <th className="p-4.5">Status</th>
                <th className="p-4.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {storeLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">
                    No custody or rental history logs found.
                  </td>
                </tr>
              ) : (
                storeLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-4.5 font-medium text-slate-200">
                      {log.item_name} 
                      <span className="block text-xs text-slate-400 font-mono mt-0.5">{log.serial_number}</span>
                    </td>
                    <td className="p-4.5 text-slate-300">
                      {log.borrower_name} 
                      <span className="block text-xs text-slate-400 mt-0.5">{log.borrower_id_or_staff}</span>
                    </td>
                    <td className="p-4.5 text-slate-300 max-w-xs truncate" title={log.checkout_condition}>
                      {log.checkout_condition || 'No review logged'}
                    </td>
                    <td className="p-4.5 text-slate-300 max-w-xs truncate" title={log.return_condition}>
                      {log.return_condition || 'Pending return'}
                    </td>
                    <td className="p-4.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${log.status === 'CHECKED_OUT' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4.5 text-right">
                      {log.status === 'CHECKED_OUT' && (
                        <button 
                          onClick={() => { setSelectedLogId(log.id); setOpenReturnModal(true); }}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm">
                          Process Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Add Equipment */}
      {openAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-1 text-slate-100">Add Store Tool / Equipment</h2>
            <p className="text-xs text-slate-400 mb-5">Register new physical assets into the G2G store directory.</p>
            
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Equipment Name</label>
                <input type="text" required value={newItem.item_name} onChange={e => setNewItem({...newItem, item_name: e.target.value})} className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500" placeholder="e.g., Ultrasound Probe A" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category</label>
                <input type="text" required placeholder="e.g., Radiology Tools, IT Hardware" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Serial Number / Asset Tag</label>
                <input type="text" value={newItem.serial_number} onChange={e => setNewItem({...newItem, serial_number: e.target.value})} className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500" placeholder="e.g., SN-99823-X" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Total Units</label>
                <input type="number" min="1" required value={newItem.total_units} onChange={e => setNewItem({...newItem, total_units: parseInt(e.target.value)})} className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>
              
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setOpenAddModal(false)} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition text-slate-300">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition text-white shadow-lg shadow-blue-600/20">Save Equipment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Checkout */}
      {openCheckoutModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-1 text-slate-100">Check Out: {selectedItem.item_name}</h2>
            <p className="text-xs text-slate-400 mb-5">Record borrower credentials and mandatory condition review.</p>
            
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Borrower / Staff Name</label>
                <input type="text" required value={checkoutData.borrower_name} onChange={e => setCheckoutData({...checkoutData, borrower_name: e.target.value})} className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Staff ID / Department</label>
                <input type="text" value={checkoutData.borrower_id_or_staff} onChange={e => setCheckoutData({...checkoutData, borrower_id_or_staff: e.target.value})} className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500" placeholder="e.g., G2G-ENG-042" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Initial Condition Review Notes</label>
                <textarea required rows="3" placeholder="e.g., Pristine condition, tested casing, includes power cable..." value={checkoutData.checkout_condition} onChange={e => setCheckoutData({...checkoutData, checkout_condition: e.target.value})} className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none"></textarea>
              </div>
              
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setOpenCheckoutModal(false)} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition text-slate-300">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl text-sm font-semibold transition text-white shadow-lg shadow-amber-600/20">Confirm Checkout</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Return */}
      {openReturnModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-1 text-slate-100">Process Equipment Return</h2>
            <p className="text-xs text-slate-400 mb-5">Audit physical status and log return conditions.</p>
            
            <form onSubmit={handleReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Return Condition Review Notes</label>
                <textarea required rows="3" placeholder="e.g., Returned fully functional, normal wear on casing..." value={returnData.return_condition} onChange={e => setReturnData({...returnData, return_condition: e.target.value})} className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none"></textarea>
              </div>
              
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setOpenReturnModal(false)} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition text-slate-300">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition text-white shadow-lg shadow-emerald-600/20">Complete Return</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}