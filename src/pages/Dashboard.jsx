import { useState, useEffect, useMemo } from 'react'
import { Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Header } from '../components/layout/Header'
import { useSheetData } from '../hooks/useSheetData'
import { Overview } from '../components/sections/Overview'
import { SocialSection } from '../components/sections/SocialSection'
import { TikTokSection } from '../components/sections/TikTokSection'
import { GoogleAdsSection } from '../components/sections/GoogleAdsSection'
import { SentimentSection } from '../components/sections/SentimentSection'
import { CompetenciaSection } from '../components/sections/CompetenciaSection'
import { HallazgosSection } from '../components/sections/HallazgosSection'
import { ProyeccionesSection } from '../components/sections/ProyeccionesSection'
import { detectAvailableBuckets } from '../utils/campaigns'

const brandThemes = {
  botanera: {
    primary: '#FF6B00', secondary: '#FFD700', bgBase: '#2A0E00',
    focusColor: 'rgba(255, 107, 0, 0.45)',
    ambient1: 'rgba(229, 62, 0, 0.30)', ambient2: 'rgba(255, 183, 77, 0.18)',
    sidebarBg: 'rgba(20, 8, 0, 0.55)',
  },
  chamoy: {
    primary: '#A855F7', secondary: '#FFD700', bgBase: '#150022',
    focusColor: 'rgba(168, 85, 247, 0.40)',
    ambient1: 'rgba(109, 40, 217, 0.30)', ambient2: 'rgba(251, 191, 36, 0.15)',
    sidebarBg: 'rgba(15, 0, 25, 0.55)',
  },
  pacific: {
    primary: '#3B82F6', secondary: '#E31E24', bgBase: '#030B1F',
    focusColor: 'rgba(59, 130, 246, 0.38)',
    ambient1: 'rgba(10, 38, 71, 0.55)', ambient2: 'rgba(227, 30, 36, 0.15)',
    sidebarBg: 'rgba(3, 10, 25, 0.55)',
  },
}

const defaultTheme = {
  primary: '#6366f1', secondary: '#818cf8', bgBase: '#0a0a1a',
  focusColor: 'rgba(99, 102, 241, 0.35)',
  ambient1: 'rgba(79, 70, 229, 0.25)', ambient2: 'rgba(129, 140, 248, 0.15)',
  sidebarBg: 'rgba(10, 10, 26, 0.55)',
}

export function Dashboard() {
  const { marcaId } = useParams()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [presentationMode, setPresentationMode] = useState(false)
  // GLOBAL bucket state — shared across all sections
  const [bucket, setBucket] = useState('mensual')

  const {
    data, loading, error, refresh, isRefreshing,
    availableMonths, brandConfig, features,
  } = useSheetData(marcaId)

  const baseTheme = brandThemes[marcaId] || defaultTheme
  const theme = brandConfig?.color_primario
    ? { ...baseTheme, primary: brandConfig.color_primario }
    : baseTheme

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0])
    }
  }, [availableMonths, selectedMonth])

  const getDataForMonth = (arr, month) =>
    Array.isArray(arr) ? (arr.find(d => d.mes === month) || null) : null
  const getArrayDataForMonth = (arr, month) =>
    Array.isArray(arr) ? arr.filter(d => d.mes === month) : []

  const filteredData = {
    empresa: data.empresa,
    facebook: getDataForMonth(data.facebook, selectedMonth),
    instagram: getDataForMonth(data.instagram, selectedMonth),
    tiktok: getDataForMonth(data.tiktok, selectedMonth),
    googleAds: getArrayDataForMonth(data.googleAds, selectedMonth),
    googleAdsCiudades: getArrayDataForMonth(data.googleAdsCiudades, selectedMonth),
    googleAdsKeywords: getArrayDataForMonth(data.googleAdsKeywords, selectedMonth),
    campanas: getArrayDataForMonth(data.campanas, selectedMonth),
    topPosts: getArrayDataForMonth(data.topPosts, selectedMonth),
    sentiment: getDataForMonth(data.sentiment, selectedMonth),
    sentimentCapturas: getArrayDataForMonth(data.sentimentCapturas, selectedMonth),
    competencia: getArrayDataForMonth(data.competencia, selectedMonth),
    hallazgos: getArrayDataForMonth(data.hallazgos, selectedMonth),
    observaciones: getArrayDataForMonth(data.observaciones, selectedMonth),
  }

  const historicalData = {
    facebook: data.facebook || [],
    instagram: data.instagram || [],
    tiktok: data.tiktok || [],
  }

  // Global buckets across all campaigns of the current month
  const availableBuckets = useMemo(
    () => detectAvailableBuckets(filteredData.campanas || []),
    [filteredData.campanas]
  )

  // If selected bucket disappears (changed month), reset to mensual
  useEffect(() => {
    if (availableBuckets.length > 0 && !availableBuckets.find(b => b.key === bucket)) {
      setBucket('mensual')
    }
  }, [availableBuckets, bucket])

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          backgroundColor: theme.bgBase,
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 50% 50%, ${theme.focusColor} 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 15% 10%, ${theme.ambient1} 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 85% 90%, ${theme.ambient2} 0%, transparent 55%)
          `,
        }}
      >
        <div className="glass-strong text-center max-w-md rounded-3xl p-8">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">⚠</span>
          </div>
          <h1 className="text-lg font-bold text-white mb-2 font-display">Error al cargar datos</h1>
          <p className="text-white/65 mb-6 text-sm">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/15 rounded-xl font-semibold text-sm text-white transition-colors border border-white/10">
              Volver
            </button>
            <button onClick={refresh}
              className="px-5 py-2.5 bg-white text-zinc-900 hover:bg-white/90 rounded-xl font-semibold text-sm transition-colors">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen ${presentationMode ? 'presentation-mode' : ''}`}
      style={{
        backgroundColor: theme.bgBase,
        backgroundImage: `
          radial-gradient(ellipse 90% 70% at 50% 40%, ${theme.focusColor} 0%, transparent 65%),
          radial-gradient(ellipse 70% 60% at 10% 10%, ${theme.ambient1} 0%, transparent 55%),
          radial-gradient(ellipse 60% 50% at 90% 95%, ${theme.ambient2} 0%, transparent 55%)
        `,
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="noise-overlay" />

      <Sidebar
        brandConfig={brandConfig}
        theme={theme}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        features={features}
      />

      <div
        className={`transition-all duration-300 relative ${
          presentationMode ? 'ml-0' : (sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[260px]')
        }`}
      >
        <Header
          brandConfig={brandConfig}
          theme={theme}
          months={availableMonths}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          onRefresh={refresh}
          isRefreshing={isRefreshing}
          presentationMode={presentationMode}
          setPresentationMode={setPresentationMode}
        />

        <main className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
          <Routes>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={
              <Overview
                data={filteredData}
                historical={historicalData}
                loading={loading}
                theme={theme}
                features={features}
              />
            } />
            <Route path="facebook" element={
              <SocialSection
                platform="facebook"
                data={filteredData.facebook}
                campanas={filteredData.campanas}
                topPosts={filteredData.topPosts?.filter(p => p.plataforma === 'facebook')}
                observaciones={filteredData.observaciones?.find(o => o.seccion === 'facebook')}
                hallazgos={filteredData.hallazgos?.filter(h => h.seccion === 'facebook')}
                historical={historicalData.facebook}
                loading={loading}
                theme={theme}
                bucket={bucket}
                setBucket={setBucket}
                availableBuckets={availableBuckets}
              />
            } />
            <Route path="instagram" element={
              <SocialSection
                platform="instagram"
                data={filteredData.instagram}
                campanas={filteredData.campanas}
                topPosts={filteredData.topPosts?.filter(p => p.plataforma === 'instagram')}
                observaciones={filteredData.observaciones?.find(o => o.seccion === 'instagram')}
                hallazgos={filteredData.hallazgos?.filter(h => h.seccion === 'instagram')}
                historical={historicalData.instagram}
                loading={loading}
                theme={theme}
                bucket={bucket}
                setBucket={setBucket}
                availableBuckets={availableBuckets}
              />
            } />
            <Route path="tiktok" element={
              <TikTokSection
                data={filteredData.tiktok}
                campanas={filteredData.campanas}
                topPosts={filteredData.topPosts?.filter(p => p.plataforma === 'tiktok')}
                observaciones={filteredData.observaciones?.find(o => o.seccion === 'tiktok')}
                hallazgos={filteredData.hallazgos?.filter(h => h.seccion === 'tiktok')}
                historical={historicalData.tiktok}
                loading={loading}
                bucket={bucket}
                setBucket={setBucket}
                availableBuckets={availableBuckets}
              />
            } />
            {features?.googleAds !== false && (
              <Route path="google-ads" element={
                <GoogleAdsSection
                  data={filteredData.googleAds}
                  ciudades={filteredData.googleAdsCiudades}
                  keywords={filteredData.googleAdsKeywords}
                  observaciones={filteredData.observaciones?.find(o => o.seccion === 'google-ads')}
                  hallazgos={filteredData.hallazgos?.filter(h => h.seccion === 'google-ads')}
                  loading={loading}
                />
              } />
            )}
            <Route path="sentiment" element={
              <SentimentSection
                data={filteredData.sentiment}
                capturas={filteredData.sentimentCapturas}
                observaciones={filteredData.observaciones?.find(o => o.seccion === 'sentiment')}
                loading={loading}
                theme={theme}
              />
            } />
            <Route path="competencia" element={
              <CompetenciaSection
                data={filteredData.competencia}
                observaciones={filteredData.observaciones?.find(o => o.seccion === 'competencia')}
                loading={loading}
                theme={theme}
              />
            } />
            <Route path="hallazgos" element={
              <HallazgosSection
                data={filteredData.hallazgos?.filter(h => h.seccion === 'hallazgos')}
                loading={loading}
                theme={theme}
              />
            } />
            <Route path="proyecciones" element={
              <ProyeccionesSection
                data={data.proyecciones || []}
                selectedMonth={selectedMonth}
                loading={loading}
                theme={theme}
                bucket={bucket}
                setBucket={setBucket}
                availableBuckets={availableBuckets}
              />
            } />
            <Route path="*" element={<Navigate to="overview" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
