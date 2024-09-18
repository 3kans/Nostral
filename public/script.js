import { NostrFetcher, eventKind } from "https://cdn.jsdelivr.net/npm/nostr-fetch@0.15.1/+esm";
import { generatePrivateKey, getPublicKey, nip19, SimplePool } from 'https://cdn.jsdelivr.net/npm/nostr-tools@1.15.0/+esm';

let privateKey = null;
let publicKey = null;
let filterWord = '#bitcoin'; // Default filter word

// List of relay URLs
const relayUrls = [
  "wss://relay.damus.io",
  "wss://relay.snort.social",
  "wss://nostr-pub.wellorder.net",
  "wss://nostr-relay.wlvs.space",
  "wss://nostr.bitcoiner.social",
  "wss://relay.nostr.info",
  "wss://relay.nostr.ch",
  "wss://nostr.rocks",
  "wss://nostr.zebedee.cloud",
  "wss://nostr.openchain.fr"
];

// Cache for user metadata
const metadataCache = {};

// Initialize SimplePool
let pool = new SimplePool();
let subs = null; // Store the current subscription

// Login function
document.getElementById('login').addEventListener('click', () => {
  const nsecInput = document.getElementById('privateKey').value.trim();

  try {
    const { type, data } = nip19.decode(nsecInput);
    if (type === 'nsec') {
      privateKey = data;
      publicKey = getPublicKey(privateKey);

      // Hide error message if any
      document.getElementById('error').style.display = 'none';

      // Clear the private key field
      document.getElementById('privateKey').value = '';

      // Show the message screen and hide the login screen
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('messageScreen').style.display = 'flex';

      // Display the user's public key
      document.getElementById('userPublicKey').textContent = `You are logged in as: ${nip19.npubEncode(publicKey)}`;

      // Fetch and display the logged-in user's metadata
      fetchLoggedInUserMetadata();

      // Load initial messages
      loadMessages();

    } else {
      document.getElementById('error').innerText = 'Invalid private key';
      document.getElementById('error').style.display = 'block';
    }
  } catch (error) {
    console.error('Error decoding private key:', error);
    document.getElementById('error').innerText = 'Failed to decode nsec1 private key';
    document.getElementById('error').style.display = 'block';
  }
});

// Function to fetch the logged-in user's metadata
async function fetchLoggedInUserMetadata() {
  const fetcher = NostrFetcher.init();
  const { username, displayName } = await fetchUserMetadata(publicKey, fetcher);
  
  // Update the DOM with user information
  document.getElementById('userDisplayName').textContent = displayName || 'User';
  document.getElementById('userUsername').textContent = username ? `@${username}` : '';
}

// Function to create a new key
document.getElementById('createKey').addEventListener('click', () => {
  // Generate a new private key
  privateKey = generatePrivateKey();
  publicKey = getPublicKey(privateKey);

  // Encode the keys in nsec1 and npub1 formats
  const nsec = nip19.nsecEncode(privateKey);
  const npub = nip19.npubEncode(publicKey);

  // Set the textareas with the keys
  document.getElementById('generatedPrivateKey').value = nsec;
  document.getElementById('generatedPublicKey').value = npub;

  // Show the key generation screen and hide the login screen
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('keyGenerationScreen').style.display = 'flex';
});

// Function to copy the private key
document.getElementById('copyPrivateKey').addEventListener('click', () => {
  const privateKeyText = document.getElementById('generatedPrivateKey').value;
  navigator.clipboard.writeText(privateKeyText).then(() => {
    alert('Private key copied to clipboard.');
  }).catch(err => {
    console.error('Error copying private key:', err);
  });
});

// Function to copy the public key
document.getElementById('copyPublicKey').addEventListener('click', () => {
  const publicKeyText = document.getElementById('generatedPublicKey').value;
  navigator.clipboard.writeText(publicKeyText).then(() => {
    alert('Public key copied to clipboard.');
  }).catch(err => {
    console.error('Error copying public key:', err);
  });
});

// Function to proceed to login
document.getElementById('proceedToLogin').addEventListener('click', () => {
  // Hide the key generation screen and show the login screen
  document.getElementById('keyGenerationScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
});

// Logout function
document.getElementById('logout').addEventListener('click', () => {
  // Clear variables
  privateKey = null;
  publicKey = null;

  // Hide the message screen and show the login screen
  document.getElementById('messageScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';

  // Close subscriptions
  if (subs) {
    subs.unsub();
    subs = null;
  }
  pool.close(relayUrls);
});

// Function to check relay status
document.getElementById('checkRelayStatus').addEventListener('click', async () => {
  const relayStatusSection = document.getElementById('relayStatusSection');
  const relayStatusList = document.getElementById('relayStatusList');
  relayStatusList.innerHTML = '';

  // Toggle the display of the relay status section
  relayStatusSection.style.display = relayStatusSection.style.display === 'none' ? 'block' : 'none';

  if (relayStatusSection.style.display === 'block') {
    const statusPromises = relayUrls.map(async (relayUrl) => {
      const li = document.createElement('li');
      li.textContent = `Checking ${relayUrl}...`;
      relayStatusList.appendChild(li);

      try {
        const ws = new WebSocket(relayUrl);

        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            ws.close();
            li.textContent = `${relayUrl} is `;
            const statusSpan = document.createElement('span');
            statusSpan.textContent = 'No response';
            statusSpan.classList.add('offline');
            li.appendChild(statusSpan);
            reject();
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeoutId);
            li.textContent = `${relayUrl} is `;
            const statusSpan = document.createElement('span');
            statusSpan.textContent = 'Online';
            statusSpan.classList.add('online');
            li.appendChild(statusSpan);
            ws.close();
            resolve();
          };

          ws.onerror = () => {
            clearTimeout(timeoutId);
            li.textContent = `${relayUrl} is `;
            const statusSpan = document.createElement('span');
            statusSpan.textContent = 'Offline';
            statusSpan.classList.add('offline');
            li.appendChild(statusSpan);
            ws.close();
            reject();
          };
        });
      } catch (error) {
        console.error(`Error checking ${relayUrl}:`, error);
        li.textContent = `${relayUrl} is `;
        const statusSpan = document.createElement('span');
        statusSpan.textContent = 'Error';
        statusSpan.classList.add('offline');
        li.appendChild(statusSpan);
      }
    });

    await Promise.all(statusPromises);
  }
});

// Function to apply the filter
document.getElementById('applyFilter').addEventListener('click', () => {
  filterWord = document.getElementById('filterWord').value.trim();
  if (!filterWord) {
    filterWord = ''; // No filter
  }
  // Update messages with the new filter
  if (subs) {
    subs.unsub();
    subs = null;
  }
  document.getElementById('messages').innerHTML = '';
  loadMessages();
});

// Function to refresh messages
document.getElementById('refreshMessages').addEventListener('click', () => {
  // Close the current subscription if any
  if (subs) {
    subs.unsub();
    subs = null;
  }
  // Clear messages
  document.getElementById('messages').innerHTML = '';
  // Load messages again
  loadMessages();
});

// Format timestamp
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Function to fetch user metadata
async function fetchUserMetadata(pubkey, fetcher) {
  if (metadataCache[pubkey]) {
    return metadataCache[pubkey];
  }
  try {
    const event = await fetcher.fetchLastEvent(relayUrls, { kinds: [eventKind.metadata], authors: [pubkey] });
    if (event) {
      const metadata = JSON.parse(event.content);
      const result = {
        username: metadata.name || 'Unknown',
        displayName: metadata.display_name || 'Unknown'
      };
      metadataCache[pubkey] = result;
      return result;
    }
  } catch (error) {
    console.error(`Error fetching metadata for ${pubkey}:`, error);
  }
  return { username: 'Unknown', displayName: 'Unknown' };
}

// Function to load messages
async function loadMessages() {
  const fetcher = NostrFetcher.init();
  const loadingDiv = document.getElementById('loading');
  const messagesList = document.getElementById('messages');

  // Show loading message
  loadingDiv.style.display = 'block';

  try {
    messagesList.innerHTML = '';

    let messageCount = 0;

    // Fetch events from the last 15 minutes
    const nMinutesAgo = (mins) => Math.floor((Date.now() - mins * 60 * 1000) / 1000);
    const postIter = fetcher.allEventsIterator(
      relayUrls,
      { kinds: [eventKind.text] },
      { since: nMinutesAgo(15) }, // Last 15 minutes
      { skipVerification: true }
    );

    for await (const ev of postIter) {
      // Apply filter
      if (filterWord === '' || ev.content.includes(filterWord)) {
        const li = document.createElement('li');

        const npubUser = nip19.npubEncode(ev.pubkey);
        const { username, displayName } = await fetchUserMetadata(ev.pubkey, fetcher);

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble', 'received');

        const messageContent = document.createElement('div');
        messageContent.textContent = ev.content;

        // Display media
        const mediaUrlMatch = ev.content.match(/(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|mp4|webm))/gi);
        if (mediaUrlMatch) {
          mediaUrlMatch.forEach(url => {
            let mediaElement;
            if (url.match(/\.(mp4|webm)$/i)) {
              // Video
              mediaElement = document.createElement('video');
              mediaElement.src = url;
              mediaElement.classList.add('media', 'video-media');
              mediaElement.controls = true;
            } else {
              // Image
              mediaElement = document.createElement('img');
              mediaElement.src = url;
              mediaElement.classList.add('media', 'image-media');
            }
            messageContent.appendChild(mediaElement);
          });
        }

        messageBubble.appendChild(messageContent);

        const messageDetails = document.createElement('div');
        messageDetails.classList.add('message-details');
        messageDetails.textContent = `Posted by: ${username} (${displayName}) | ${formatTimestamp(ev.created_at)} | ${npubUser}`;

        // Add elements in the desired order
        li.appendChild(messageDetails);
        li.appendChild(messageBubble);

        messagesList.appendChild(li);

        messageCount++;
      }
    }

    if (messageCount === 0) {
      const noMessages = document.createElement('p');
      noMessages.textContent = 'No messages found.';
      messagesList.appendChild(noMessages);
    }

  } catch (error) {
    console.error('Error fetching events:', error);
    messagesList.innerHTML = '';
    const errorMsg = document.createElement('p');
    errorMsg.style.color = 'red';
    errorMsg.textContent = 'Error fetching messages. Please try again later.';
    messagesList.appendChild(errorMsg);
  } finally {
    // Hide loading message
    loadingDiv.style.display = 'none';
  }

  // Start real-time monitoring
  startRealTimeMonitoring();
}

// Function to start real-time monitoring
function startRealTimeMonitoring() {
  // Close the current subscription if any
  if (subs) {
    subs.unsub();
  }

  const filters = [
    {
      kinds: [eventKind.text],
      since: Math.floor(Date.now() / 1000), // Events from now
    }
  ];

  subs = pool.sub(relayUrls, filters);

  subs.on('event', async (event) => {
    if (filterWord === '' || event.content.includes(filterWord)) {
      const messagesList = document.getElementById('messages');

      const li = document.createElement('li');

      const npubUser = nip19.npubEncode(event.pubkey);
      const { username, displayName } = await fetchUserMetadata(event.pubkey, NostrFetcher.init());

      const messageBubble = document.createElement('div');
      messageBubble.classList.add('message-bubble', 'received');

      const messageContent = document.createElement('div');
      messageContent.textContent = event.content;

      // Display media
      const mediaUrlMatch = event.content.match(/(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|mp4|webm))/gi);
      if (mediaUrlMatch) {
        mediaUrlMatch.forEach(url => {
          let mediaElement;
          if (url.match(/\.(mp4|webm)$/i)) {
            // Video
            mediaElement = document.createElement('video');
            mediaElement.src = url;
            mediaElement.classList.add('media', 'video-media');
            mediaElement.controls = true;
          } else {
            // Image
            mediaElement = document.createElement('img');
            mediaElement.src = url;
            mediaElement.classList.add('media', 'image-media');
          }
          messageContent.appendChild(mediaElement);
        });
      }

      messageBubble.appendChild(messageContent);

      const messageDetails = document.createElement('div');
      messageDetails.classList.add('message-details');
      messageDetails.textContent = `Posted by: ${username} (${displayName}) | ${formatTimestamp(event.created_at)} | ${npubUser}`;

      // Add elements in the desired order
      li.appendChild(messageDetails);
      li.appendChild(messageBubble);

      messagesList.appendChild(li);

      // Scroll to the bottom
      messagesList.scrollTop = messagesList.scrollHeight;
    }
  });

  subs.on('eose', () => {
    console.log('End of stored events');
  });
}
