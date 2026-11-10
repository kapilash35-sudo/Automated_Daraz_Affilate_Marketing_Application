import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Seeding database with initial channels, posts, and engagement heatmaps...');

  // 1. Clean existing records
  await prisma.engagement.deleteMany();
  await prisma.post.deleteMany();
  await prisma.group.deleteMany();

  // 2. Create WhatsApp Groups
  const newsSourceGroup = await prisma.group.create({
    data: {
      wahaChatId: '120363024881111111@g.us',
      name: 'Tamil Flash News Alerts (Source)',
      role: 'SOURCE',
      type: 'NEWS',
      isActive: true,
    },
  });

  const darazSourceGroup = await prisma.group.create({
    data: {
      wahaChatId: '120363024882222222@g.us',
      name: 'Daraz Deals & Coupons Inbound (Source)',
      role: 'SOURCE',
      type: 'DARAZ',
      isActive: true,
    },
  });

  const newsDestGroup = await prisma.group.create({
    data: {
      wahaChatId: '120363024883333333@g.us',
      name: '⚡ யாழ்/இலங்கை முக்கிய செய்திகள் 24/7 (Broadcast)',
      role: 'DESTINATION',
      type: 'NEWS',
      isActive: true,
    },
  });

  const darazDestGroup = await prisma.group.create({
    data: {
      wahaChatId: '120363024884444444@g.us',
      name: '🛒 Daraz Mega Discounts & Flash Sales (Broadcast)',
      role: 'DESTINATION',
      type: 'DARAZ',
      isActive: true,
    },
  });

  console.log('[Seed] Created Groups: 2 Source Groups, 2 Destination Broadcast Channels');

  // 3. Create Sample News Posts (Sent & Duplicates)
  const sampleNews = [
    {
      title: 'இலங்கையில் எரிபொருள் விலையில் அதிரடி மாற்றம் – நள்ளிரவு முதல் அமுல்!',
      content: 'இலங்கை பெற்றோலியக் கூட்டுத்தாபனம் எரிபொருள் விலைகளில் திருத்தம் மேற்கொண்டுள்ளது. பெற்றோல் லீற்றருக்கு ரூ. 15 குறைக்கப்பட்டுள்ளது.',
      status: 'SENT' as const,
      reactions: 42,
    },
    {
      title: 'நாளை முதல் நாடளாவிய ரீதியில் தொடருந்து சேவைகள் வழமைக்கு திரும்பும்',
      content: 'தொழிற்பாட்டு சிக்கல்கள் காரணமாக தடைப்பட்ட தொடருந்து சேவைகள் நாளை காலை 5 மணி முதல் வழமைக்கு கொண்டுவரப்படும் என திணைக்களம் அறிவித்துள்ளது.',
      status: 'SENT' as const,
      reactions: 28,
    },
    {
      title: 'தங்கத்தின் விலையில் மீண்டும் பாரிய வீழ்ச்சி – இன்றைய நிலவரம்',
      content: 'கொழும்பு செட்டியார் தெருவில் 24 கரட் தங்க பவுண் ஒன்றின் விலை ரூ. 185,000 ஆக குறைந்துள்ளது.',
      status: 'SENT' as const,
      reactions: 56,
    },
    {
      title: 'எரிபொருள் விலைக் குறைப்பு தொடர்பில் புதிய அறிவிப்பு',
      content: 'பெற்றோல் விலை 15 ரூபாவால் குறைக்கப்பட்டமை தொடர்பில் அமைச்சரவை தீர்மானம்.',
      status: 'DUPLICATE' as const,
      reason: 'AI Deduplication: Duplicate of earlier fuel price reduction story sent 4 hours ago.',
      reactions: 0,
    },
    {
      title: 'பல்கலைக்கழக மாணவர்களுக்கான புதிய உதவித்தொகை திட்டம் ஆரம்பம்',
      content: 'உயர்கல்வி அமைச்சினால் குறைந்த வருமானம் பெறும் குடும்பங்களைச் சேர்ந்த மாணவர்களுக்கான மாதாந்த கொடுப்பனவு அதிகரிக்கப்பட்டுள்ளது.',
      status: 'SENT' as const,
      reactions: 35,
    },
  ];

  const createdNewsPosts = [];
  for (const item of sampleNews) {
    const post = await prisma.post.create({
      data: {
        type: 'NEWS',
        sourceRef: 'EXTERNAL_SCRAPER',
        destinationGroupId: item.status === 'SENT' ? newsDestGroup.id : null,
        status: item.status,
        duplicateReason: item.reason || null,
        sentAt: item.status === 'SENT' ? new Date(Date.now() - Math.random() * 86400000 * 3) : null,
        reactionsCount: item.reactions,
        rawPayload: {
          title: item.title,
          content: item.content,
          sourceName: 'Lanka News Web',
        },
        processedText: `🚨 *முக்கிய செய்தி:* ${item.title}\n\n🔹 ${item.content}\n\n📲 *உடனுக்குடன் செய்திகளை அறிய எமது WhatsApp குழுவில் இணையுங்கள்!*`,
        wahaMessageId: `waha_msg_${Math.random().toString(36).substring(7)}`,
      },
    });
    createdNewsPosts.push(post);
  }

  // 4. Create Sample Daraz Deals
  const sampleDeals = [
    {
      title: 'Xiaomi Smart Band 8 Pro – AMOLED Display, 14-day Battery',
      orig: 16500,
      disc: 11499,
      pct: 30,
      clicks: 184,
      url: 'https://www.daraz.lk/products/xiaomi-smart-band-8-pro-i1234567.html',
    },
    {
      title: 'Anker Soundcore Life P2i True Wireless Earbuds (Dual EQ, Bass)',
      orig: 9500,
      disc: 5990,
      pct: 37,
      clicks: 142,
      url: 'https://www.daraz.lk/products/anker-soundcore-p2i-i2345678.html',
    },
    {
      title: 'Philips High Speed Electric Kettle 1.5L Stainless Steel',
      orig: 7800,
      disc: 4890,
      pct: 37,
      clicks: 95,
      url: 'https://www.daraz.lk/products/philips-kettle-i3456789.html',
    },
    {
      title: 'Baseus 65W GaN Fast Charger Multiport (Laptop & Mobile)',
      orig: 12000,
      disc: 7990,
      pct: 33,
      clicks: 215,
      url: 'https://www.daraz.lk/products/baseus-65w-gan-i4567890.html',
    },
  ];

  const createdDarazPosts = [];
  for (const deal of sampleDeals) {
    const post = await prisma.post.create({
      data: {
        type: 'DARAZ',
        sourceRef: deal.url,
        destinationGroupId: darazDestGroup.id,
        status: 'SENT',
        sentAt: new Date(Date.now() - Math.random() * 86400000 * 4),
        clicksCount: deal.clicks,
        rawPayload: {
          title: deal.title,
          originalPrice: deal.orig,
          discountPrice: deal.disc,
          discountPercentage: deal.pct,
          affiliateUrl: deal.url,
        },
        processedText: `⚡ *மின்னல் நேர தள்ளுபடி!* ⚡\n\n*${deal.title}*\n❌ முந்தைய விலை: Rs. ${deal.orig}\n✅ சலுகை விலை: *Rs. ${deal.disc}* (${deal.pct}% OFF)\n\n👉 *உடனே ஓடர் செய்ய:* http://localhost:4000/r/PLACEHOLDER`,
        wahaMessageId: `waha_deal_${Math.random().toString(36).substring(7)}`,
      },
    });
    createdDarazPosts.push(post);
  }

  // 5. Generate Engagement Records for Heatmap Visualization (Reaction & Click timestamps)
  console.log('[Seed] Generating simulated reaction & click engagements over past 14 days...');

  const emojis = ['👍', '❤️', '🔥', '😮', '👏'];
  // Generate realistic reaction distribution (peaking during evening hours 19:00 - 22:00 and lunch 12:00 - 13:00)
  for (const post of createdNewsPosts.filter((p) => p.status === 'SENT')) {
    const count = post.reactionsCount;
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(Math.random() * 12);
      // Biased toward prime hours: 19, 20, 21, 12, 13
      const primeHours = [19, 20, 20, 21, 21, 22, 12, 13, 8, 9, 14, 17];
      const hour = primeHours[Math.floor(Math.random() * primeHours.length)];
      const minute = Math.floor(Math.random() * 60);

      const recordedAt = new Date();
      recordedAt.setDate(recordedAt.getDate() - daysAgo);
      recordedAt.setHours(hour, minute, 0, 0);

      await prisma.engagement.create({
        data: {
          postId: post.id,
          type: 'REACTION',
          recordedAt,
          metadata: {
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
          },
        },
      });
    }
  }

  // Generate realistic click distribution (peaking during lunch breaks 12:00 - 14:00 and evening paydays 20:00 - 23:00)
  for (const deal of createdDarazPosts) {
    const clicks = deal.clicksCount;
    for (let i = 0; i < clicks; i++) {
      const daysAgo = Math.floor(Math.random() * 10);
      const buyerHours = [12, 13, 13, 14, 20, 21, 21, 22, 22, 23, 11, 15];
      const hour = buyerHours[Math.floor(Math.random() * buyerHours.length)];
      const minute = Math.floor(Math.random() * 60);

      const recordedAt = new Date();
      recordedAt.setDate(recordedAt.getDate() - daysAgo);
      recordedAt.setHours(hour, minute, 0, 0);

      await prisma.engagement.create({
        data: {
          postId: deal.id,
          type: 'CLICK',
          recordedAt,
          metadata: {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          },
        },
      });
    }
  }

  console.log('[Seed] Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

