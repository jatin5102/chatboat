# 🏢 WhatsApp Real Estate Chatbot (whatsapp-web.js + ESM + TypeScript)

An intelligent, automated real estate lead qualification and personalized collateral distribution WhatsApp bot built with **Node.js (ESM)**, **TypeScript**, and **`whatsapp-web.js`**. 

**No WhatsApp Business API or third-party paid subscriptions required!** It authenticates directly through WhatsApp Web using a terminal QR code with persistent session caching (`LocalAuth`).

---

## ✨ Key Features

1. **Step-by-Step Lead Qualification Questionnaire**:
   - 👤 **Full Name** collection.
   - 📍 **Target City / Locality** (e.g. Gurgaon, Bangalore, Mumbai).
   - 👥 **Profile Segmenting**:
     - **Home Buyer / Property Investor**: Directly routed to project inventory.
     - **Channel Partner / Broker**: Automatically prompted for their **RERA Registration Number** or Agency Name.
   - 🏢 **Dynamic Property Selection**: Presents an interactive list of available developments.

2. **Dynamic Personalized Watermarking (On-the-Fly)**:
   - 🖼️ **Image Gallery**: When a user requests property photos, each high-res image is dynamically branded with:
     - Semi-transparent verified badge
     - Full footer banner: `Prepared exclusively for: [User Name] | Mobile: [User Phone]`
     - Timestamp and confidentiality disclaimer
   - 📄 **PDF Brochure**: When a user requests the project brochure, the existing PDF is read and injected with:
     - Top executive header: `EXCLUSIVE PROPOSAL | PREPARED FOR: [Name] ([Phone])`
     - Diagonal semi-transparent watermark across every page
     - Bottom confidentiality footer strip

3. **Multi-Action Interactive Menu**:
   - `1`: Download personalized PDF brochure
   - `2`: Send watermarked photo gallery
   - `3`: View key amenities & RERA specs
   - `4`: Switch to explore other properties
   - `5`: Restart conversation or update profile
   - `6`: Request an instant callback from a senior relationship manager

4. **Persistent Session Management (`LocalAuth`)**:
   - Saves authentication tokens in `.wwebjs_auth/` so you only scan the QR code once.

---

## 📁 Project Structure

```
chatbot/
├── assets/
│   ├── properties/
│   │   ├── skyline/              # Property 1 assets
│   │   │   ├── brochure.pdf
│   │   │   ├── elevation.jpg
│   │   │   ├── living_room.jpg
│   │   │   └── master_bedroom.jpg
│   │   └── greenvalley/          # Property 2 assets
│   │       ├── brochure.pdf
│   │       ├── villa_front.jpg
│   │       └── villa_interior.jpg
│   └── temp/                     # Output folder for tests & temporary assets
├── scripts/
│   ├── seed-assets.ts            # Seeds sample PDFs & property images
│   └── test-watermark.ts         # Standalone test for image & PDF watermarking
├── src/
│   ├── config/
│   │   └── properties.ts         # Property catalog configuration
│   ├── services/
│   │   ├── bot.service.ts        # Conversational flow & state machine
│   │   ├── session.service.ts    # User session manager
│   │   └── watermark.service.ts  # Sharp (images) & pdf-lib (PDF) watermarking
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces & enums
│   └── index.ts                  # WhatsApp client bootstrap & QR handler
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v22.14.0)
- **WhatsApp**: Installed on a mobile phone with a camera to scan the QR code.

### 2. Installation
Dependencies are already installed. If setting up on a new machine:
```bash
npm install
```

### 3. Seed Sample Assets
Generate high-resolution sample project images and official PDF brochures:
```bash
npx tsx scripts/seed-assets.ts
```

### 4. Test Watermarking
Verify that image and PDF personalization functions properly:
```bash
npx tsx scripts/test-watermark.ts
```

### 5. Launch the Bot
Start the bot in development mode with live watch:
```bash
npm run dev
```

1. A QR code will appear in your terminal.
2. Open **WhatsApp** on your phone > **Linked Devices** > **Link a Device**.
3. Point your camera at the terminal QR code to log in.
4. Once connected, your bot will output:
   `🎉 WhatsApp Bot is ONLINE and ready to handle incoming leads!`

---

## 💬 Conversation Flow Example

```
[User]: Hi

[Bot]: 👋 Welcome to Apex Prime Realty Advisory!
       We specialize in verified luxury properties with instant digital collaterals, verified brochures, and personalized pricing.
       To get started, may I please know your Full Name?

[User]: Rahul Sharma

[Bot]: Nice to connect with you, Rahul Sharma! 😊
       Which City or Locality are you currently exploring properties in?
       (e.g. Gurgaon, Bangalore, Mumbai, Pune, Noida)

[User]: Gurgaon

[Bot]: Got it! Location recorded: Gurgaon 📍
       Could you please let us know your profile?
       1️⃣ I am a Home Buyer / Property Investor
       2️⃣ I am a Channel Partner / Real Estate Broker
       👉 Reply with 1 or 2

[User]: 2

[Bot]: Welcome, Partner! 🤝
       Please enter your RERA Registration Number or Agency Name for our broker desk records:

[User]: HARERA/GGM/2024/782

[Bot]: Thank you! Partner verified: HARERA/GGM/2024/782 ✅
       Accessing exclusive partner collateral & project inventory...

       🏢 FEATURED EXCLUSIVE DEVELOPMENTS
       1️⃣ Skyline Heights Luxury Towers
          📍 Location: Sector 62, Golf Course Ext Road, Gurgaon
          💰 Range: ₹2.85 Cr - ₹4.50 Cr
          🌟 Highlights: 3 & 4 BHK Ultra-Modern Sky Residences

       2️⃣ Green Valley Elite Villas
          📍 Location: Whitefield - Sarjapur Link Road, Bangalore
          💰 Range: ₹3.90 Cr - ₹6.80 Cr
          🌟 Highlights: 4 & 5 BHK Private Forest Villa Living

       👉 Reply with 1 or 2 to view details & download media:

[User]: 1

[Bot]: 🏢 SKYLINE HEIGHTS LUXURY TOWERS
       ━━━━━━━━━━━━━━━━━━━━
       📍 Location: Sector 62, Golf Course Ext Road, Gurgaon
       💰 Price Range: ₹2.85 Cr - ₹4.50 Cr
       📜 RERA No: RC/REP/HARERA/GGM/2024/891
       ...
       What would you like to receive?
       1️⃣ 📄 Download Official Brochure (Personalized PDF with your Name & Phone)
       2️⃣ 🖼️ View Image Gallery (Watermarked with your Name & Phone)
       3️⃣ 🌟 Key Amenities & Specifications
       4️⃣ 🔄 Choose Another Property
       5️⃣ 🔁 Start Over / Update Profile
       6️⃣ 📞 Request a Callback from Relationship Manager

[User]: 1

[Bot]: ⏳ Generating your personalized brochure for Rahul Sharma (919876543210)...
[Bot sends PDF document stamped with header, footer & diagonal watermark for Rahul Sharma]

[User]: 2

[Bot]: ⏳ Personalizing and stamping 3 high-res gallery images with your details...
[Bot sends 3 photos stamped with personalized bottom banner: "Prepared exclusively for: Rahul Sharma | Mobile: 919876543210"]
```

---

## 🛠️ Adding New Properties & Collaterals

Open [`src/config/properties.ts`](file:///d:/node/chatbot/src/config/properties.ts) and add a new item to the `PROPERTIES` array:

```typescript
{
  id: 'prop-3',
  name: 'Ocean Crest Luxury Penthouses',
  tagline: 'Sea-facing Duplex Residences',
  location: 'Worli, Mumbai',
  priceRange: '₹12 Cr - ₹25 Cr',
  reraNumber: 'P51900001234',
  description: 'Ultra-luxury sea-facing residences overlooking the Arabian Sea.',
  amenities: ['Private Marina', 'Helipad', 'Cigar Lounge'],
  brochurePath: path.join(rootDir, 'assets/properties/oceancrest/brochure.pdf'),
  imagePaths: [
    path.join(rootDir, 'assets/properties/oceancrest/sea_view.jpg'),
    path.join(rootDir, 'assets/properties/oceancrest/lobby.jpg')
  ]
}
```

Simply drop your PDF files and JPG/PNG images into the corresponding directory. The bot dynamically personalizes them during transmission without altering your original files.
