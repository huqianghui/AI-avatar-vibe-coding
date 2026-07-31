# Technology Stack

**Project:** AI Avatar Platform (BeiGene MR Training)
**Researched:** 2026-03-24
**Overall Confidence:** HIGH (official docs verified for all Azure services)

---

## Recommended Stack

### Core Application Framework (Existing -- Keep As-Is)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| FastAPI | >=0.115.0 | Backend API framework | Already in skeleton. Async-native, WebSocket support for Realtime API proxying, excellent DI for service layer |
| React | ^18.3.0 | Frontend UI | Already in skeleton. Hooks-based, broad ecosystem, mature |
| SQLAlchemy 2.0 | >=2.0.35 (async) | ORM + database | Already in skeleton. Async session support, Alembic migrations |
| Pydantic v2 | >=2.0 | Schema validation | Already in skeleton. Fast, `from_attributes` for ORM mapping |
| Vite 6 | ^6.0.0 | Build tool | Already in skeleton. Fast HMR, native ESM |
| TanStack Query v5 | ^5.60.0 | Server state | Already in skeleton. Caching, retry, mutation lifecycle |

**Decision: Do NOT change the core framework.** The existing skeleton is well-chosen. Focus investment on Azure AI integrations.

---

### Azure AI Services -- LLM & Conversation

| Technology | Version/Model | Purpose | Why |
|------------|---------------|---------|-----|
| Azure OpenAI (v1 API) | `openai/v1` endpoint (no `api-version` param) | Chat completions, scoring, HCP persona simulation | New v1 API is GA since Aug 2025 -- simpler auth, no dated api-version params, cross-provider support. Use `OpenAI()` client directly with Azure base_url. |
| GPT-4.1 | deployment: `gpt-4.1` | Primary LLM for text coaching, scoring prompts, HCP persona | Best price/performance for structured outputs, function calling. Successor to GPT-4o line. |
| GPT-4.1-mini | deployment: `gpt-4.1-mini` | Bulk scoring, report generation, lighter tasks | Cost-efficient for high-volume operations like batch scoring |
| Azure OpenAI Realtime API | `gpt-realtime` / `gpt-realtime-mini` model via WebSocket | Low-latency voice-to-voice conversation for F2F coaching | Native audio I/O, ~100ms latency via WebRTC, server VAD. Use `openai[realtime]` Python extra. |

**Python SDK:**
```bash
pip install "openai>=2.29.0"
pip install "openai[realtime]"     # For Realtime WebSocket support
pip install azure-identity          # For Entra ID token auth
```

**TypeScript SDK:**
```bash
npm install openai                  # >=4.80.0
npm install @azure/identity         # For keyless auth
```

**API Pattern (v1 -- RECOMMENDED):**
```python
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    base_url="https://YOUR-RESOURCE.openai.azure.com/openai/v1/"
)

# Chat completions for scoring/HCP simulation
response = client.chat.completions.create(
    model="gpt-4.1",  # deployment name
    messages=[...],
)

# Realtime for voice coaching
async with client.realtime.connect(model="gpt-realtime") as conn:
    # WebSocket session for voice interaction
    ...
```

**Confidence:** HIGH -- verified from official Azure docs (updated 2026-03-20).

---

### Azure AI Services -- Speech

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Azure Speech SDK (Python) | `azure-cognitiveservices-speech` (latest) | Server-side STT/TTS for fallback mode, batch transcription | Mature SDK, supports 140+ locales including `zh-CN`, `zh-TW`, `en-US` |
| Azure Speech SDK (JavaScript) | `microsoft-cognitiveservices-speech-sdk` (latest) | Browser-side real-time STT, Avatar rendering via WebRTC | Required for real-time avatar synthesis in browser. WebRTC peer connection. |

**Python SDK:**
```bash
pip install azure-cognitiveservices-speech
```

**TypeScript SDK:**
```bash
npm install microsoft-cognitiveservices-speech-sdk
```

**Key Voice Names for this project:**
- Chinese: `zh-CN-XiaoxiaoNeural`, `zh-CN-YunxiNeural`
- English: `en-US-AvaMultilingualNeural`, `en-US-AndrewMultilingualNeural`
- HD Voices (low latency): `en-US-Ava:DragonHDLatestNeural`

**Confidence:** HIGH -- verified from official Azure Speech docs.

---

### Azure AI Services -- Avatar

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Azure TTS Avatar (Real-time) | Speech SDK (JS) + WebRTC | Visual digital HCP representation in F2F coaching | Photorealistic talking avatar synced with TTS. Real-time via WebRTC in browser. |
| Azure TTS Avatar (Batch) | REST API `2024-04-15-preview` | Pre-rendered avatar videos for conference mode demos | Batch-synthesized video content, supports gestures |
| Voice Live API | WebSocket `api-version=2025-10-01` | Unified voice agent with optional avatar | Single API combining STT + LLM + TTS + Avatar. Simplifies orchestration. Premium feature. |

**Standard Avatar Characters (recommended for HCP personas):**
- `lisa` (casual-sitting, technical-sitting) -- professional female, multiple styles
- `harry` (business) -- professional male
- `max` (business, formal) -- male with many gesture options
- `meg` (business, formal) -- female with many gesture options
- Photo avatars: `liwei`, `ling`, `sakura`, `ren` -- Asian-presenting characters for China market

**Architecture Decision: Two-tier Avatar Strategy**
1. **Primary (Premium):** Voice Live API -- single WebSocket, fully managed, avatar + voice + LLM
2. **Fallback (Standard):** Azure Speech TTS only (no avatar video) -- cheaper, works everywhere

**Avatar Region Constraints (CRITICAL):**
Real-time avatar is only available in: `eastus2`, `northeurope`, `southcentralus`, `southeastasia`, `swedencentral`, `westeurope`, `westus2`

For Asia-Pacific users, use `southeastasia` (avatar + speech + OpenAI all available).

**Confidence:** HIGH -- verified from official Azure Speech regions page (updated 2026-03-17).

---

### Azure AI Services -- Content Understanding

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Azure Content Understanding | GA API `2025-11-01` | Training material analysis (PDF/Word/audio/video), multimodal scoring evaluation | Extracts structured data from documents, transcribes audio, analyzes video -- replaces need for multiple separate services. Use for training material ingestion and multimodal session evaluation. |

**Python SDK:**
```bash
pip install azure-ai-contentunderstanding
pip install azure-identity
```

**Usage Pattern:**
```python
from azure.ai.contentunderstanding import ContentUnderstandingClient
from azure.core.credentials import AzureKeyCredential

client = ContentUnderstandingClient(
    endpoint=endpoint,
    credential=AzureKeyCredential(key)
)

# Analyze uploaded training materials
poller = client.begin_analyze(
    analyzer_id="prebuilt-invoice",  # or custom analyzer
    inputs=[AnalysisInput(url=document_url)],
)
result = poller.result()
```

**Prebuilt Analyzers Relevant to This Project:**
- `prebuilt-audioSearch` -- transcripts, summaries, speaker labels from coaching session recordings
- `prebuilt-videoSearch` -- keyframes, transcripts from conference presentations
- Custom analyzers -- define schema for extracting key messages, scoring criteria from training docs

**Prerequisite Deployments Required:** GPT-4.1, GPT-4.1-mini, text-embedding-3-large (must be deployed in the same Foundry resource)

**Confidence:** HIGH -- GA since 2025-11-01, verified from official docs (updated 2026-03-13).

---

### Internationalization (i18n)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-i18next | ^15.0.0 | Frontend i18n framework | De facto standard for React i18n. TypeScript support, namespace lazy loading, Vite compatible. Built on i18next core. |
| i18next | ^24.0.0 | i18n core library | Language detection, interpolation, plurals, context. Required by react-i18next. |
| i18next-http-backend | ^3.0.0 | Lazy load translations | Load translation JSON files on demand per namespace/language. Reduces initial bundle. |
| i18next-browser-languagedetector | ^8.0.0 | Auto-detect user language | Detects from browser settings, URL, cookie. Respects user preference. |

**Installation:**
```bash
npm install react-i18next i18next i18next-http-backend i18next-browser-languagedetector
```

**Structure:**
```
frontend/src/
  locales/
    zh-CN/
      common.json        # Shared UI strings
      coaching.json       # F2F coaching domain
      conference.json     # Conference mode
      scoring.json        # Scoring and feedback
      admin.json          # Admin panel
    en/
      common.json
      coaching.json
      conference.json
      scoring.json
      admin.json
```

**Setup Pattern:**
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'zh-CN',
    supportedLngs: ['zh-CN', 'en'],
    ns: ['common', 'coaching', 'conference', 'scoring', 'admin'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: { escapeValue: false },
  });
```

**Confidence:** HIGH -- react-i18next is the overwhelmingly dominant React i18n solution. Verified Vite + TS compatibility.

---

### Database & Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Azure Database for PostgreSQL Flexible Server | v16 | Production database | Managed PostgreSQL, async via asyncpg driver, Alembic migrations. Already planned in CLAUDE.md |
| aiosqlite | >=0.20.0 | Local dev database | Already in skeleton for SQLite dev mode |
| asyncpg | >=0.29.0 | PostgreSQL async driver | Already in skeleton optional deps |
| Azure Blob Storage | `azure-storage-blob` | Training material files, voice recordings, avatar videos | Scalable object storage with SAS token access, lifecycle policies for retention |

**Python SDK (add to dependencies):**
```bash
pip install "azure-storage-blob>=12.20.0"
pip install "azure-identity>=1.17.0"
```

**Confidence:** HIGH -- standard Azure PaaS choices, already partially defined in project skeleton.

---

### Dashboard & Charting

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Recharts | ^2.13.0 | Scoring radar charts, progress dashboards, trend lines | React-native chart library, supports radar/spider charts (critical for multi-dimensional scoring), responsive, composable. Lightweight vs. alternatives. |

**Installation:**
```bash
npm install recharts
```

**Why Recharts over alternatives:**
- Recharts: Built for React, declarative, supports RadarChart natively. ~45KB gzipped.
- Chart.js/react-chartjs-2: More setup overhead, canvas-based (harder to style with Tailwind).
- Apache ECharts: Powerful but heavy (~300KB), overkill for this dashboard scope.
- D3: Too low-level for our needs, requires significant custom code.

**Confidence:** MEDIUM -- Recharts is well-established but verify radar chart customization meets the multi-dimensional scoring visual requirements during implementation.

---

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| python-jose | >=3.3.0 | JWT token creation/validation | Already in skeleton. Simple JWT for MVP auth |
| passlib[bcrypt] | >=1.7.4 | Password hashing | Already in skeleton |
| azure-identity | >=1.17.0 | Azure service authentication (Entra ID) | Required for all Azure SDK calls, supports DefaultAzureCredential for local dev + managed identity in production |

**MVP Auth:** Simple username/password with JWT tokens (already in skeleton).
**Future:** Azure AD (Entra ID) SSO. Architecture must support swapping auth provider -- use dependency injection in FastAPI.

**Confidence:** HIGH -- existing pattern is sound for MVP.

---

### WebSocket & Real-time Communication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| FastAPI WebSocket | built-in | Backend WebSocket for proxying Realtime API | FastAPI has native WebSocket route support. Backend acts as secure proxy between browser and Azure OpenAI/Voice Live. |
| websockets | >=13.0 | Python WebSocket client | Already in skeleton. Used for connecting to Azure Realtime/Voice Live from backend. |

**Architecture: Backend WebSocket Proxy Pattern**

Browser cannot directly connect to Azure OpenAI Realtime or Voice Live (CORS, credentials). The backend acts as a WebSocket relay:

```
Browser <--WebSocket--> FastAPI Backend <--WebSocket--> Azure OpenAI Realtime / Voice Live
              |
              +-- Audio chunks (PCM 24kHz)
              +-- Text messages
              +-- Session events
```

For Avatar (using Speech SDK JS), the browser connects directly to Azure Speech via WebRTC (this is supported and expected).

**Confidence:** HIGH -- standard pattern for Azure Realtime API integration.

---

### Additional Frontend Dependencies (New)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| recharts | ^2.13.0 | Multi-dimensional scoring charts | Radar charts for scoring dimensions |
| react-i18next | ^15.0.0 | Internationalization | See i18n section above |
| i18next | ^24.0.0 | i18n core | Required by react-i18next |
| i18next-http-backend | ^3.0.0 | Translation lazy loading | On-demand translation file loading |
| i18next-browser-languagedetector | ^8.0.0 | Language detection | Auto-detect user locale |
| microsoft-cognitiveservices-speech-sdk | latest | Azure Speech + Avatar in browser | Required for real-time avatar WebRTC |

### Additional Backend Dependencies (New)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| openai[realtime] | >=2.29.0 | Azure OpenAI chat + realtime | v1 API, realtime WebSocket support |
| azure-identity | >=1.17.0 | Azure auth (Entra ID / DefaultAzureCredential) | All Azure SDK authentication |
| azure-cognitiveservices-speech | latest | Server-side STT/TTS | Fallback voice processing, batch transcription |
| azure-ai-contentunderstanding | latest | Document/audio/video analysis | Training material ingestion, session evaluation |
| azure-storage-blob | >=12.20.0 | Blob storage for files | Training materials, voice recordings |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| LLM API style | v1 API (`/openai/v1/`) | Legacy dated API (`api-version=2024-xx-xx`) | v1 is GA, no more monthly version churn, simpler `OpenAI()` client |
| Voice interaction | Voice Live API | DIY: Speech SDK STT + OpenAI + Speech SDK TTS | Voice Live is managed, lower latency, built-in echo cancellation + noise suppression. DIY requires complex orchestration. |
| Avatar | Azure TTS Avatar (standard) | Custom avatar | Custom requires 10min video recording per character, separate training. Standard avatars (Lisa, Max, Liwei) are sufficient for MVP. |
| i18n | react-i18next | react-intl (FormatJS) | react-i18next has better lazy loading, simpler API, stronger TypeScript support. react-intl is ICU-focused, heavier setup. |
| Charts | Recharts | ECharts / Chart.js | Recharts is React-native, lightweight, built-in RadarChart. ECharts is heavy. Chart.js needs wrapper library. |
| Document processing | Azure Content Understanding | Azure Document Intelligence + Azure Video Indexer separately | Content Understanding is the unified successor, handles all modalities (doc/audio/video) in one service. GA since Nov 2025. |
| Database | PostgreSQL Flexible Server | Azure Cosmos DB | Relational data model fits training sessions, scoring, users. Cosmos adds complexity without benefit for this workload. |
| File storage | Azure Blob Storage | Azure Files | Blob Storage is cheaper, better SDK support, lifecycle policies for retention. Azure Files is for SMB mount scenarios. |
| Frontend state | TanStack Query (existing) | Redux / Zustand | Already in skeleton. TanStack Query handles server state. Auth store uses lightweight approach (no Redux needed). |
| Voice SDK (browser) | Azure Speech SDK JS | Web Speech API | Web Speech API is browser-native but limited: no Chinese TTS, no avatar, inconsistent across browsers. Azure SDK is required for avatar. |

---

## Installation

### Backend (add to existing pyproject.toml dependencies)
```bash
# New Azure AI dependencies
pip install "openai[realtime]>=2.29.0"
pip install azure-identity>=1.17.0
pip install azure-cognitiveservices-speech
pip install azure-ai-contentunderstanding
pip install "azure-storage-blob>=12.20.0"
```

### Frontend (add to existing package.json)
```bash
# i18n
npm install react-i18next i18next i18next-http-backend i18next-browser-languagedetector

# Charts
npm install recharts

# Azure Speech SDK (for Avatar + browser STT/TTS)
npm install microsoft-cognitiveservices-speech-sdk

# Types
npm install -D @types/recharts
```

---

## Azure Service Configuration Summary

| Azure Service | Resource Type | Recommended Region | Pricing Tier |
|---------------|---------------|-------------------|-------------|
| Azure OpenAI | Foundry Resource | `swedencentral` or `eastus2` | Standard (pay-per-token) |
| Azure Speech | Foundry Resource (shared) | `swedencentral` or `eastus2` | Standard S0 |
| Azure TTS Avatar | Same Speech resource | `westus2` or `swedencentral` | Standard S0 (premium add-on) |
| Azure Content Understanding | Foundry Resource (shared) | `eastus` or `westeurope` | Standard |
| Azure Database for PostgreSQL | Flexible Server | Same region as app | Burstable B1ms (dev), GP D2s (prod) |
| Azure Blob Storage | Storage Account (v2) | Same region as app | Hot tier |
| Azure Container Apps | Container Apps Environment | Same region as app | Consumption plan |

**Critical Region Constraint:** Avatar is only available in 7 regions. For maximum feature availability, use `swedencentral` (Europe) or `westus2` (US). Deploy all resources in the same region to minimize latency.

---

## Environment Variables (New -- add to Settings)

```python
# Azure OpenAI v1 API
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_CHAT_MINI_DEPLOYMENT=gpt-4.1-mini
AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-realtime

# Azure Speech
AZURE_SPEECH_KEY=your-key
AZURE_SPEECH_REGION=swedencentral

# Azure Content Understanding
AZURE_CONTENT_UNDERSTANDING_ENDPOINT=https://your-resource.cognitiveservices.azure.com
AZURE_CONTENT_UNDERSTANDING_KEY=your-key

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER_MATERIALS=training-materials
AZURE_STORAGE_CONTAINER_RECORDINGS=voice-recordings

# Voice Live (optional, premium)
AZURE_VOICE_LIVE_ENDPOINT=wss://your-resource.services.ai.azure.com
AZURE_VOICE_LIVE_MODEL=gpt-4.1

# Feature Flags
FEATURE_AVATAR_ENABLED=true
FEATURE_VOICE_LIVE_ENABLED=false
```

---

## Sources

- [Azure OpenAI v1 API docs](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle) -- updated 2026-03-20
- [Azure OpenAI Realtime API](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/realtime-audio) -- gpt-realtime models, WebRTC/WebSocket
- [Azure Speech TTS Avatar overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar) -- updated 2026-02-17
- [Azure Speech TTS Avatar real-time synthesis](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/real-time-synthesis-avatar) -- WebRTC setup, JS SDK
- [Azure Speech standard avatars](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars) -- character list
- [Azure Speech regions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions) -- avatar region constraints
- [Voice Live API overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live) -- updated 2026-02-04
- [Voice Live API how-to](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to) -- WebSocket events, avatar config
- [Azure Content Understanding overview](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview) -- GA 2025-11-01
- [Azure Content Understanding REST API quickstart](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/quickstart/use-rest-api) -- Python SDK
- [OpenAI Python package](https://pypi.org/project/openai/) -- v2.29.0, released 2026-03-17
- [react-i18next](https://react.i18next.com/) -- React i18n framework
