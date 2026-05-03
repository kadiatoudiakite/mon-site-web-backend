// src/pages/ProfilUniversite.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  User,
  Mail,
  Phone,
  Lock,
  Save,
  Edit2,
  X,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

export default function ProfilUniversite() {
  const [profil, setProfil] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
  });
  const [modeEdition, setModeEdition] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  const getToken = () => localStorage.getItem('token');

  // Charger le profil
  const fetchProfil = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/universite/profile', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await response.json();
      if (data.success) {
        setProfil(data.data);
        setFormData(data.data);
      } else {
        setMessage({ type: 'error', text: data.message || 'Erreur chargement' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur réseau' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfil();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch('http://localhost:5000/api/universite/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (data.success) {
        setProfil(formData);
        setModeEdition(false);
        setMessage({ type: 'success', text: 'Profil mis à jour avec succès' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Erreur mise à jour' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur réseau' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères' });
      return;
    }
    setChangingPassword(true);
    try {
      const response = await fetch('http://localhost:5000/api/universite/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Mot de passe modifié avec succès' });
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Erreur changement mot de passe' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur réseau' });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex p-3 bg-indigo-100 rounded-2xl mb-4">
            <Building2 className="h-8 w-8 text-indigo-700" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Profil de l'université</h1>
          <p className="text-gray-500 mt-2">Gérez vos informations personnelles et de contact</p>
        </motion.div>

        {/* Message de notification */}
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-800 border-l-4 border-green-500' : 'bg-red-50 text-red-800 border-l-4 border-red-500'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <p className="flex-1">{message.text}</p>
            <button onClick={() => setMessage({ type: '', text: '' })} className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* Carte principale */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
        >
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-8 py-6 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-white">Informations générales</h2>
              <p className="text-indigo-200 text-sm mt-1">Modifiez vos coordonnées ci-dessous</p>
            </div>
            {!modeEdition ? (
              <button
                onClick={() => setModeEdition(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition"
              >
                <Edit2 className="h-4 w-4" />
                Modifier
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setModeEdition(false);
                    setFormData(profil);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 rounded-xl font-medium hover:bg-indigo-50 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </button>
              </div>
            )}
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'université</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  {modeEdition ? (
                    <input
                      type="text"
                      name="nom"
                      value={formData.nom || ''}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  ) : (
                    <div className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-gray-800">
                      {profil.nom || '—'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du responsable</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  {modeEdition ? (
                    <input
                      type="text"
                      name="prenom"
                      value={formData.prenom || ''}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  ) : (
                    <div className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-gray-800">
                      {profil.prenom || '—'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  {modeEdition ? (
                    <input
                      type="email"
                      name="email"
                      value={formData.email || ''}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  ) : (
                    <div className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-gray-800">
                      {profil.email || '—'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  {modeEdition ? (
                    <input
                      type="tel"
                      name="telephone"
                      value={formData.telephone || ''}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  ) : (
                    <div className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-gray-800">
                      {profil.telephone || '—'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Carte modification mot de passe */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">Sécurité</h3>
            </div>
          </div>
          <div className="p-8">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-medium transition"
            >
              <Lock className="h-4 w-4" />
              Changer le mot de passe
            </button>
          </div>
        </motion.div>
      </div>

      {/* Modal changement mot de passe */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Modifier le mot de passe</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-white hover:bg-white/20 p-1 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2"
                >
                  {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Modifier'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}