# Smart Diagnosis Backend (Hyundai Only)

## Environment Variables

```env
SMART_DIAGNOSIS_API_KEY=your_api_key_here
SMART_DIAGNOSIS_MODEL=deepseek-chat
SMART_DIAGNOSIS_API_BASE_URL=https://api.deepseek.com
SMART_DIAGNOSIS_API_PATH=/chat/completions
SMART_DIAGNOSIS_TIMEOUT_MS=15000
```

## Endpoint

- `POST /api/user/smart-diagnosis`
- Requires authenticated user session.
- Body:

```json
{
  "question": "سيارتي هيونداي إلنترا 2023 تظهر فيها لمبة المحرك وكود P0301، ما الخطوات المبدئية؟"
}
```

## Conversation History Endpoint

- `GET /api/user/smart-diagnosis/history?limit=30`
- Returns latest saved conversations for the logged-in customer.

## Example Responses

### 1) Accepted Hyundai question

```json
{
  "success": true,
  "status": "accepted",
  "data": {
    "answer": "..."
  }
}
```

### 2) Rejected non-Hyundai question

```json
{
  "success": false,
  "status": "rejected",
  "message": "هذا المشخص الذكي مخصص لسيارات هيونداي فقط، ولا يمكنني المساعدة في سيارات من شركات أخرى."
}
```

### 3) Rejected out-of-domain question

```json
{
  "success": false,
  "status": "rejected",
  "message": "هذا المشخص الذكي مخصص لتشخيص وصيانة سيارات هيونداي فقط."
}
```

## Run

```bash
npm install
npm run dev
```

## Run Tests

```bash
npm test
```
