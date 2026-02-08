# AI Self-Querying Retriever
## Technical Architecture Presentation

---

## Slide 1: System Overview

### AI Self-Querying Retriever
**Professional-grade Multi-Agent RAG System**

A sophisticated Retrieval-Augmented Generation (RAG) platform that combines:
- 5 retrieval strategies (Vector, BM25, Hybrid, Self-Query, HyDE)
- LangGraph-based multi-agent orchestration
- Advanced post-retrieval augmentation
- Real-time analytics and observability
- Full-stack application with document management

**Tech Stack:** React + TypeScript | Django 5 + DRF | LangGraph | ChromaDB | PostgreSQL | Redis

---

## Slide 2: High-Level Architecture

### Four-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│         PRESENTATION LAYER (React + TypeScript)          │
│  Dashboard | Query UI | Documents | Collections | Analytics│
└─────────────────────────────────────────────────────────┘
                          ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────┐
│      API GATEWAY LAYER (Node.js + Express)              │
│  Rate Limiting | CORS | Routing | WebSocket Manager     │
└─────────────────────────────────────────────────────────┘
                          ↕ Proxy
┌─────────────────────────────────────────────────────────┐
│   BACKEND APPLICATION LAYER (Django + LangGraph)        │
│  Multi-Agent Pipeline | Services | Celery Workers       │
└─────────────────────────────────────────────────────────┘
                          ↕ Queries
┌─────────────────────────────────────────────────────────┐
│    DATA LAYER (PostgreSQL | ChromaDB | Redis)          │
│  Metadata | Vectors | Cache | Task Queue               │
└─────────────────────────────────────────────────────────┘
```

**Port Configuration:**
- Frontend: 3088
- API Gateway: 3087
- Backend: 8083
- ChromaDB: 8000
- Redis: 6379
- PostgreSQL: 5432

---

## Slide 3: LangGraph Multi-Agent System

### Agent Orchestration Flow

```
User Query
    ↓
[Query Analyzer] ← LLM analyzes query, extracts filters
    ↓
[Supervisor] ← Routes based on analysis
    ↓
┌─────────────────────────────────────────┐
│      RETRIEVAL STRATEGIES (Choose 1)     │
├─────────────────────────────────────────┤
│ • Vector Retriever    → Semantic search │
│ • BM25 Retriever     → Keyword search   │
│ • Hybrid Merger      → Combined approach│
│ • Self-Query         → LLM + metadata   │
│ • Hypothetical Q     → HyDE technique   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  AUGMENTATION (Optional, Multi-Select)   │
├─────────────────────────────────────────┤
│ • Reranker          → Cross-encoder     │
│ • Compressor        → LLM compression   │
│ • Query Expander    → Synonym expansion │
└─────────────────────────────────────────┘
    ↓
[Answer Generator] ← LLM synthesizes response
    ↓
Results + Execution Trace
```

**Key Innovation:** State-based routing using LangGraph's StateGraph for dynamic pipeline construction

---

## Slide 4: Core Components

### Backend Services Architecture

**1. Vector Store Service (ChromaDBService)**
- Manages embeddings and collections
- Uses OpenAI text-embedding-ada-002
- Supports metadata filtering
- HTTP client for ChromaDB

**2. Retriever Implementations (5 Types)**
- `VanillaRetriever`: Pure vector similarity
- `SelfQueryRetriever`: LLM-based metadata extraction
- `BM25Retriever`: TF-IDF keyword search
- `HybridRetriever`: Weighted ensemble
- `HypotheticalQuestionRetriever`: HyDE implementation

**3. Augmentation Services**
- Cross-encoder reranking (ms-marco-MiniLM-L-6-v2)
- Context compression via LLM
- Query expansion with synonyms

**4. Observability Service**
- LangSmith integration for tracing
- LangFuse for LLM monitoring
- Real-time execution tracking

---

## Slide 5: Data Flow - Query Execution

### End-to-End Query Processing

```
1. User submits query via React UI
   ↓
2. API Gateway (Express)
   • Rate limiting check (200 req/15min)
   • Request logging + correlation ID
   • Forward to backend
   ↓
3. Django Backend
   • Create Query record in PostgreSQL
   • Initialize LangGraph pipeline
   ↓
4. LangGraph Execution
   a) Query Analyzer: Extract intent + filters
   b) Supervisor: Route to strategy
   c) Retrieval: Fetch documents from ChromaDB
   d) Augmentation: Optional rerank/compress
   e) Answer Generation: LLM synthesis
   ↓
5. Persistence
   • Save QueryResult records
   • Update execution metrics
   ↓
6. Response Stream
   • Real-time via WebSocket
   • Or synchronous HTTP response
   ↓
7. Frontend Display
   • Ranked results with scores
   • Execution trace visualization
   • Performance metrics
```

**Average Latency:** 800ms - 3s (depending on strategy and augmentation)

---

## Slide 6: Data Flow - Document Ingestion

### Async Document Processing Pipeline

```
1. User uploads documents (Frontend)
   ↓
2. API Gateway → Backend
   ↓
3. Django Backend
   • Create Document records (PostgreSQL)
   • Create DocumentMetadata records
   • Queue Celery task (202 Accepted)
   • Return immediately to user
   ↓
4. Celery Worker (Async)
   a) Retrieve documents from PostgreSQL
   b) Chunk documents (if needed)
   c) Generate embeddings (OpenAI API)
   d) Index into ChromaDB
   e) Update Collection stats
   f) Mark batch as complete
   ↓
5. User receives notification
   • Real-time status via WebSocket
   • Can query immediately after indexing
```

**Processing Capacity:** 100+ documents per batch | Parallelized across workers

---

## Slide 7: Technology Stack

### Frontend Stack
- **React 18**: Component-based UI
- **TypeScript**: Type safety
- **Vite**: Fast build tool
- **Tailwind CSS**: Utility-first styling
- **Zustand**: Lightweight state management
- **Axios**: HTTP client
- **React Router**: Client-side routing

### Backend Stack
- **Django 5**: Web framework + ORM
- **Django REST Framework**: API serialization
- **Daphne**: ASGI server (WebSocket support)
- **LangChain 0.3.21**: LLM framework
- **LangGraph**: Agent orchestration
- **Celery**: Distributed task queue
- **psycopg2**: PostgreSQL driver

### Infrastructure
- **PostgreSQL 16**: Primary database
- **ChromaDB**: Vector database
- **Redis 7**: Cache + broker + results
- **Docker Compose**: Container orchestration
- **LangFuse**: Self-hosted observability
- **Flower**: Celery monitoring

---

## Slide 8: Key Features & Capabilities

### Retrieval Features
✓ **5 Retrieval Strategies**
  - Semantic search (vector embeddings)
  - Keyword search (BM25)
  - Hybrid ensemble
  - Self-querying with metadata
  - Hypothetical document embeddings (HyDE)

✓ **Advanced Augmentation**
  - Cross-encoder reranking
  - LLM-based context compression
  - Query expansion with synonyms

### System Features
✓ **Multi-Agent Orchestration**
  - Dynamic pipeline construction
  - Conditional routing based on query analysis
  - State-based agent communication

✓ **Real-Time Analytics**
  - Query trends and method comparison
  - Performance metrics per strategy
  - Execution trace visualization

✓ **Production-Ready**
  - Rate limiting and security headers
  - Health checks and monitoring
  - Async processing for scalability
  - Comprehensive error handling

---

## Slide 9: API Architecture

### RESTful API Endpoints

**Query Endpoints**
- `POST /api/v1/retriever/query/` - Execute query with config
- `GET /api/v1/retriever/queries/` - Query history
- `GET /api/v1/retriever/queries/{id}/results/` - Specific results

**Document Management**
- `GET/POST /api/v1/retriever/documents/` - CRUD operations
- `POST /api/v1/retriever/documents/bulk-upload/` - Async upload
- `POST /api/v1/retriever/documents/search/` - Full-text search

**Collection Management**
- `GET/POST /api/v1/retriever/collections/` - Collection CRUD
- `GET /api/v1/retriever/collections/{id}/stats/` - Statistics

**Pipeline Management**
- `GET/POST /api/v1/retriever/pipelines/` - Saved pipelines
- `POST /api/v1/retriever/pipelines/{id}/execute/` - Execute

**Analytics & Agents**
- `GET /api/v1/retriever/analytics/` - Dashboard stats
- `GET /api/v1/retriever/agent-executions/` - Execution history
- `GET /api/v1/retriever/agent-graph/` - Workflow visualization

**WebSocket:** `/ws` - Real-time result streaming

---

## Slide 10: Data Models

### Core Database Schema

**Documents & Collections**
```
Collection
├── name: CharField
├── description: TextField
├── embedding_model: CharField
└── document_count: IntegerField

Document
├── title: CharField
├── content: TextField
├── metadata_json: JSONField
├── collection_name: ForeignKey(Collection)
├── source: CharField
└── created_at: DateTimeField

DocumentMetadata
├── document: OneToOneField(Document)
├── year: IntegerField
├── topics: ArrayField
├── subtopic: CharField
└── custom_metadata: JSONField
```

**Query Tracking**
```
Query
├── query_text: TextField
├── retrieval_method: CharField
├── filters: JSONField
├── execution_time_ms: IntegerField
└── created_at: DateTimeField

QueryResult
├── query: ForeignKey(Query)
├── document: ForeignKey(Document)
├── rank: IntegerField
├── score: FloatField
├── is_reranked: BooleanField
└── compressed_content: TextField
```

---

## Slide 11: Performance & Scalability

### System Performance Characteristics

**Query Performance**
- Vector search: 100-300ms (ChromaDB)
- BM25 search: 50-150ms (in-memory index)
- Hybrid: 200-400ms (parallel execution)
- Reranking: +200-500ms (depends on doc count)
- LLM calls: 500-2000ms (OpenAI API latency)

**Throughput**
- Rate limit: 200 requests per 15 minutes
- Concurrent queries: 10+ (ASGI async)
- Document indexing: 100+ docs/batch

**Scalability Features**
- Horizontal scaling of Celery workers
- Redis-backed distributed task queue
- Connection pooling for PostgreSQL
- Lazy-loaded ChromaDB connections
- Stateless API gateway design

**Resource Usage**
- Backend: 512MB-2GB RAM (depends on model size)
- ChromaDB: 1-2GB RAM per 100K documents
- Redis: 100-500MB RAM
- PostgreSQL: 500MB-2GB RAM

---

## Slide 12: Observability & Monitoring

### Comprehensive Observability Stack

**LangSmith Integration**
- LLM call tracing
- Chain execution visualization
- Token usage tracking
- Cost analysis per query

**LangFuse Dashboard (Port 3085)**
- Self-hosted observability
- Real-time execution timelines
- Agent interaction graphs
- Performance bottleneck identification

**Celery Flower (Port 5583)**
- Task queue monitoring
- Worker health checks
- Failed task analysis
- Task execution history

**Application Logging**
- Correlation IDs for request tracking
- Structured JSON logs
- Error tracking with stack traces
- Performance metric logging

**Health Checks**
- API Gateway: `/health`
- Backend: `/api/health/`
- Aggregated service status
- Automatic degradation handling

---

## Slide 13: Security & Best Practices

### Security Implementation

**API Gateway Security**
- Rate limiting: 200 requests/15min per IP
- CORS configuration for allowed origins
- Helmet.js for security headers
- Request sanitization

**Backend Security**
- Django secret key management
- Environment-based configuration
- Database connection encryption
- API key validation for OpenAI

**Best Practices**
- Type safety (TypeScript + Python type hints)
- Error handling at all layers
- Graceful degradation
- Transaction management (PostgreSQL)
- Connection pooling
- Idempotent operations

**Deployment Considerations**
- Docker containerization
- Environment variable isolation
- Secrets management
- Network segmentation
- HTTPS enforcement (production)

---

## Slide 14: Use Cases & Applications

### Practical Applications

**1. Enterprise Knowledge Management**
- Index internal documentation
- Self-service Q&A for employees
- Metadata-filtered search by department/year

**2. Research & Academic**
- Scientific paper retrieval
- Topic-based literature review
- Citation and reference tracking

**3. Customer Support**
- Knowledge base search
- Automated ticket routing
- Context-aware response generation

**4. Legal & Compliance**
- Document discovery with date filters
- Topic-based legal research
- Precedent finding

**5. Content Management**
- CMS search enhancement
- Multi-modal content retrieval
- Personalized content recommendations

**Renewable Energy Use Case (Current)**
- 100+ documents on renewable energy topics
- Filterable by year, topics, subtopic
- Query methods optimized for technical content

---

## Slide 15: Future Enhancements

### Roadmap & Extension Opportunities

**Short-Term Enhancements**
- [ ] Multi-modal retrieval (images, PDFs)
- [ ] User authentication and RBAC
- [ ] Query history export (CSV, JSON)
- [ ] Custom embedding model support
- [ ] A/B testing framework for strategies

**Medium-Term Features**
- [ ] Federated search across multiple collections
- [ ] Graph-based retrieval (knowledge graphs)
- [ ] Active learning for retrieval optimization
- [ ] Multi-lingual support
- [ ] Fine-tuned reranking models

**Advanced Capabilities**
- [ ] Real-time collaborative filtering
- [ ] Reinforcement learning from user feedback
- [ ] Explainable AI for result ranking
- [ ] Integration with external knowledge bases
- [ ] Auto-scaling based on load

**Research Directions**
- [ ] Novel retrieval strategies evaluation
- [ ] Hybrid embedding approaches
- [ ] Cost-performance optimization
- [ ] Low-latency serving optimizations

---

## Slide 16: Getting Started

### Quick Start Guide

**Prerequisites**
- Docker & Docker Compose
- OpenAI API key
- 4GB+ RAM, 10GB disk space

**Setup Steps**
```bash
# 1. Clone repository
git clone <repository-url>
cd self-querying-retriever

# 2. Configure environment
cp .env.example .env
# Edit .env with your OpenAI API key

# 3. Start services
docker-compose up -d

# 4. Initialize database
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser

# 5. Access application
Frontend: http://localhost:3088
API: http://localhost:3087
Admin: http://localhost:8083/admin
LangFuse: http://localhost:3085
Flower: http://localhost:5583
```

**First Query**
1. Navigate to http://localhost:3088/query
2. Enter a query about renewable energy
3. Select retrieval method (try "Vector" first)
4. Apply filters (optional)
5. Click "Search" and view results!

---

## Slide 17: Architecture Strengths

### Why This Architecture?

**Modularity**
- Clear separation of concerns
- Independent service scaling
- Easy to add new retrieval strategies
- Pluggable augmentation techniques

**Extensibility**
- New agents can be added to LangGraph
- Custom retrievers inherit from BaseRetriever
- API-first design for integrations
- MCP server for AI client support

**Production-Ready**
- Comprehensive error handling
- Health checks at all layers
- Graceful degradation
- Async processing for scalability
- Real-time monitoring

**Developer Experience**
- Type-safe codebase (TS + Python types)
- Hot reload in development
- Comprehensive API documentation
- Agent execution replay for debugging
- Visual workflow diagrams

**Performance**
- Optimized database queries with indexes
- Connection pooling
- Redis caching
- Parallel retrieval execution
- Streaming responses via WebSocket

---

## Slide 18: Questions & Discussion

### Contact & Resources

**Project Information**
- Repository: [GitHub Link]
- Documentation: `/docs` directory
- API Docs: OpenAPI/Swagger at `/api/docs`
- Architecture Diagram: `docs/technical-architecture.drawio`

**Key Contacts**
- Project Lead: [Name]
- Technical Architect: [Name]
- DevOps: [Name]

**Additional Resources**
- LangChain Documentation: https://docs.langchain.com
- LangGraph Guide: https://langchain-ai.github.io/langgraph/
- ChromaDB Docs: https://docs.trychroma.com
- Django REST Framework: https://www.django-rest-framework.org

**Support Channels**
- Issues: GitHub Issues
- Discussions: GitHub Discussions
- Email: [support email]

---

## Thank You!

**Questions?**

---

## Notes for PowerPoint Conversion

This markdown presentation can be converted to PowerPoint using:

**Option 1: Pandoc**
```bash
pandoc technical-architecture-presentation.md -o presentation.pptx
```

**Option 2: Reveal.js (HTML)**
```bash
pandoc -t revealjs -s technical-architecture-presentation.md -o presentation.html
```

**Option 3: Marp**
```bash
marp technical-architecture-presentation.md -o presentation.pptx
```

Each slide is separated by `---` and can be styled further with CSS themes.
