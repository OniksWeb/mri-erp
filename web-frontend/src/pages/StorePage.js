import React, { useState, useEffect } from 'react';
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
    } catch (err) {
      console.error('Error fetching store data:', err);
      setError('Failed to load store inventory.');
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
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.serial_number && item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...new Set(storeItems.map(i => i.category))];

  return (
    <div className="p-6 bg-[#0f172a] min-h-screen text-white">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">G2G Medical Store & Equipment Custody</h1>
          <p className="text-gray-400 text-sm">Track physical tools, equipment rentals, condition reviews, and custody logs.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setOpenAddModal(true)} 
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium text-sm transition">
            + Add Store Equipment
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-900/50 border border-green-500 rounded text-green-200 text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition ${activeTab === 'inventory' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
          Store Equipment Inventory
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition ${activeTab === 'logs' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
          Custody & Rental Logs ({storeLogs.filter(l => l.status === 'CHECKED_OUT').length} Active)
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input 
          type="text" 
          placeholder="Search by equipment name or serial number..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-4 py-2 text-sm flex-1 focus:outline-none focus:border-blue-500 text-white"
        />
        {activeTab === 'inventory' && (
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            {categories.map((cat, idx) => (
              <option key={idx} value={cat}>{cat.toUpperCase()}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tab Content: Store Inventory */}
      {activeTab === 'inventory' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="p-4">Equipment Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Serial Number</th>
                <th className="p-4">Available / Total</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr><td colSpan="5" className="p-6 text-center text-gray-500">No store items found.</td></tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition">
                    <td className="p-4 font-medium">{item.item_name}</td>
                    <td className="p-4 text-gray-300">{item.category}</td>
                    <td className="p-4 text-gray-400 font-mono text-xs">{item.serial_number || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${item.available_units > 0 ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
                        {item.available_units} / {item.total_units} Available
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        disabled={item.available_units <= 0}
                        onClick={() => { setSelectedItem(item); setOpenCheckoutModal(true); }}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition ${item.available_units > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-800 text-gray-500 cursor-not-allowed'}`}>
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

      {/* Tab Content: Custody Logs */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="p-4">Equipment</th>
                <th className="p-4">Borrower / Staff</th>
                <th className="p-4">Checkout Condition</th>
                <th className="p-4">Return Condition</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {storeLogs.length === 0 ? (
                <tr><td colSpan="6" className="p-6 text-center text-gray-500">No custody history logs found.</td></tr>
              ) : (
                storeLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/50 transition">
                    <td className="p-4 font-medium">{log.item_name} <span className="block text-xs text-gray-400 font-mono">{log.serial_number}</span></td>
                    <td className="p-4">{log.borrower_name} <span className="block text-xs text-gray-400">{log.borrower_id_or_staff}</span></td>
                    <td className="p-4 text-gray-300 max-w-xs truncate" title={log.checkout_condition}>{log.checkout_condition || 'No review'}</td>
                    <td className="p-4 text-gray-300 max-w-xs truncate" title={log.return_condition}>{log.return_condition || 'Pending return'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${log.status === 'CHECKED_OUT' ? 'bg-blue-900/60 text-blue-300' : 'bg-emerald-900/60 text-emerald-300'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {log.status === 'CHECKED_OUT' && (
                        <button 
                          onClick={() => { setSelectedLogId(log.id); setOpenReturnModal(true); }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-medium transition">
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

      {/* Add Equipment Modal */}
      {openAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Add Physical Store Tool / Equipment</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Equipment Name</label>
                <input type="text" required value={newItem.item_name} onChange={e => setNewItem({...newItem, item_name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Category</label>
                <input type="text" required placeholder="e.g., Radiology Tools, IT Hardware, PPE" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Serial Number / Asset Tag</label>
                <input type="text" value={newItem.serial_number} onChange={e => setNewItem({...newItem, serial_number: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white font-mono" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Total Units</label>
                <input type="number" min="1" required value={newItem.total_units} onChange={e => setNewItem({...newItem, total_units: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white" />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setOpenAddModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium">Save Equipment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {openCheckoutModal && selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-1">Check Out: {selectedItem.item_name}</h2>
            <p className="text-xs text-gray-400 mb-4">Record borrower details and initial condition review.</p>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Borrower / Staff Name</label>
                <input type="text" required value={checkoutData.borrower_name} onChange={e => setCheckoutData({...checkoutData, borrower_name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Staff ID / Department</label>
                <input type="text" value={checkoutData.borrower_id_or_staff} onChange={e => setCheckoutData({...checkoutData, borrower_id_or_staff: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Initial Condition Review (Detailed notes)</label>
                <textarea required rows="3" placeholder="e.g., Brand new unit, intact casing, includes battery charger and carry pouch..." value={checkoutData.checkout_condition} onChange={e => setCheckoutData({...checkoutData, checkout_condition: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setOpenCheckoutModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded text-sm font-medium">Confirm Checkout</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {openReturnModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-1">Process Equipment Return</h2>
            <p className="text-xs text-gray-400 mb-4">Provide condition review upon return to audit wear or damage.</p>
            <form onSubmit={handleReturn} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Return Condition Review (Detailed notes)</label>
                <textarea required rows="3" placeholder="e.g., Returned in good working order, minor scratch on surface display..." value={returnData.return_condition} onChange={e => setReturnData({...returnData, return_condition: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setOpenReturnModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm font-medium">Complete Return</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}