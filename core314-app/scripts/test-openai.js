
const apiKey = process.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ VITE_OPENAI_API_KEY not found in environment');
  process.exit(1);
}

console.log('Testing OpenAI API integration...');
console.log('Using API key:', apiKey.substring(0, 30) + '...');

async function testOpenAI() {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: 'Say "API key is valid" if you can read this message.'
          }
        ],
        max_tokens: 20
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ OpenAI API test PASSED');
      console.log('Response:', data.choices[0].message.content);
      console.log('Model used:', data.model);
      process.exit(0);
    } else {
      console.error('❌ OpenAI API test FAILED');
      console.error('Status:', response.status);
      console.error('Error:', data.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ OpenAI API test FAILED with exception:');
    console.error(error.message);
    process.exit(1);
  }
}

testOpenAI();
