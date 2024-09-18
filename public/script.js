import { NostrFetcher, eventKind } from "https://cdn.jsdelivr.net/npm/nostr-fetch@0.15.1/+esm";
import { generatePrivateKey, getPublicKey, nip19, SimplePool } from 'https://cdn.jsdelivr.net/npm/nostr-tools@1.15.0/+esm';

let privateKey = null;
let publicKey = null;
let filterWord = '#bitcoin'; // Palavra de filtro padrão

// Lista de URLs de relé
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

// Cache para metadados do usuário
const metadataCache = {};

// Inicializar o SimplePool
let pool = new SimplePool();
let subs = null; // Armazenar a subscrição atual

// Função de login
document.getElementById('login').addEventListener('click', () => {
  const nsecInput = document.getElementById('privateKey').value.trim();

  try {
    const { type, data } = nip19.decode(nsecInput);
    if (type === 'nsec') {
      privateKey = data;
      publicKey = getPublicKey(privateKey);

      // Ocultar mensagem de erro, se houver
      document.getElementById('error').style.display = 'none';

      // Limpar o campo de chave privada
      document.getElementById('privateKey').value = '';

      // Mostrar a tela de mensagens e ocultar a tela de login
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('messageScreen').style.display = 'flex';

      // Exibir a chave pública do usuário
      document.getElementById('userPublicKey').textContent = `Você está conectado como: ${nip19.npubEncode(publicKey)}`;

      // Buscar e exibir os metadados do usuário logado
      fetchLoggedInUserMetadata();

      // Carregar mensagens iniciais
      loadMessages();

    } else {
      document.getElementById('error').innerText = 'Chave privada inválida';
      document.getElementById('error').style.display = 'block';
    }
  } catch (error) {
    console.error('Erro ao decodificar a chave privada:', error);
    document.getElementById('error').innerText = 'Falha ao decodificar a chave privada nsec1';
    document.getElementById('error').style.display = 'block';
  }
});

// Função para buscar os metadados do usuário logado
async function fetchLoggedInUserMetadata() {
  const fetcher = NostrFetcher.init();
  const { username, displayName } = await fetchUserMetadata(publicKey, fetcher);
  
  // Atualizar o DOM com as informações do usuário
  document.getElementById('userDisplayName').textContent = displayName || 'Usuário';
  document.getElementById('userUsername').textContent = username ? `@${username}` : '';
}

// Função para criar nova chave
document.getElementById('createKey').addEventListener('click', () => {
  // Gerar nova chave privada
  privateKey = generatePrivateKey();
  publicKey = getPublicKey(privateKey);

  // Codificar as chaves em formato nsec1 e npub1
  const nsec = nip19.nsecEncode(privateKey);
  const npub = nip19.npubEncode(publicKey);

  // Definir as textareas com as chaves
  document.getElementById('generatedPrivateKey').value = nsec;
  document.getElementById('generatedPublicKey').value = npub;

  // Mostrar a tela de geração de chaves e ocultar a tela de login
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('keyGenerationScreen').style.display = 'flex';
});

// Função para copiar chave privada
document.getElementById('copyPrivateKey').addEventListener('click', () => {
  const privateKeyText = document.getElementById('generatedPrivateKey').value;
  navigator.clipboard.writeText(privateKeyText).then(() => {
    alert('Chave privada copiada para a área de transferência.');
  }).catch(err => {
    console.error('Erro ao copiar chave privada:', err);
  });
});

// Função para copiar chave pública
document.getElementById('copyPublicKey').addEventListener('click', () => {
  const publicKeyText = document.getElementById('generatedPublicKey').value;
  navigator.clipboard.writeText(publicKeyText).then(() => {
    alert('Chave pública copiada para a área de transferência.');
  }).catch(err => {
    console.error('Erro ao copiar chave pública:', err);
  });
});

// Função para continuar para o login
document.getElementById('proceedToLogin').addEventListener('click', () => {
  // Ocultar tela de geração de chaves e mostrar tela de login
  document.getElementById('keyGenerationScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
});

// Função de logout
document.getElementById('logout').addEventListener('click', () => {
  // Limpar variáveis
  privateKey = null;
  publicKey = null;

  // Ocultar tela de mensagens e mostrar tela de login
  document.getElementById('messageScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';

  // Encerrar subscrições
  if (subs) {
    subs.unsub();
    subs = null;
  }
  pool.close(relayUrls);
});


// Função para verificar o status dos relés
document.getElementById('checkRelayStatus').addEventListener('click', async () => {
  const relayStatusSection = document.getElementById('relayStatusSection');
  const relayStatusList = document.getElementById('relayStatusList');
  relayStatusList.innerHTML = '';

  // Alternar a exibição da seção de status dos relés
  relayStatusSection.style.display = relayStatusSection.style.display === 'none' ? 'block' : 'none';

  if (relayStatusSection.style.display === 'block') {
    const statusPromises = relayUrls.map(async (relayUrl) => {
      const li = document.createElement('li');
      li.textContent = `Verificando ${relayUrl}...`;
      relayStatusList.appendChild(li);

      try {
        const ws = new WebSocket(relayUrl);

        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            ws.close();
            li.textContent = `${relayUrl} está `;
            const statusSpan = document.createElement('span');
            statusSpan.textContent = 'Sem resposta';
            statusSpan.classList.add('offline');
            li.appendChild(statusSpan);
            reject();
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeoutId);
            li.textContent = `${relayUrl} está `;
            const statusSpan = document.createElement('span');
            statusSpan.textContent = 'Online';
            statusSpan.classList.add('online');
            li.appendChild(statusSpan);
            ws.close();
            resolve();
          };

          ws.onerror = () => {
            clearTimeout(timeoutId);
            li.textContent = `${relayUrl} está `;
            const statusSpan = document.createElement('span');
            statusSpan.textContent = 'Offline';
            statusSpan.classList.add('offline');
            li.appendChild(statusSpan);
            ws.close();
            reject();
          };
        });
      } catch (error) {
        console.error(`Erro ao verificar ${relayUrl}:`, error);
        li.textContent = `${relayUrl} está `;
        const statusSpan = document.createElement('span');
        statusSpan.textContent = 'Erro';
        statusSpan.classList.add('offline');
        li.appendChild(statusSpan);
      }
    });

    await Promise.all(statusPromises);
  }
});

// Função para aplicar o filtro
document.getElementById('applyFilter').addEventListener('click', () => {
  filterWord = document.getElementById('filterWord').value.trim();
  if (!filterWord) {
    filterWord = ''; // Sem filtro
  }
  // Atualizar mensagens com o novo filtro
  if (subs) {
    subs.unsub();
    subs = null;
  }
  document.getElementById('messages').innerHTML = '';
  loadMessages();
});

// Função para atualizar as mensagens
document.getElementById('refreshMessages').addEventListener('click', () => {
  // Encerrar a subscrição atual, se houver
  if (subs) {
    subs.unsub();
    subs = null;
  }
  // Limpar mensagens
  document.getElementById('messages').innerHTML = '';
  // Carregar mensagens novamente
  loadMessages();
});

// Formatar timestamp
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Função para buscar metadados de um usuário
async function fetchUserMetadata(pubkey, fetcher) {
  if (metadataCache[pubkey]) {
    return metadataCache[pubkey];
  }
  try {
    const event = await fetcher.fetchLastEvent(relayUrls, { kinds: [eventKind.metadata], authors: [pubkey] });
    if (event) {
      const metadata = JSON.parse(event.content);
      const result = {
        username: metadata.name || 'Desconhecido',
        displayName: metadata.display_name || 'Desconhecido'
      };
      metadataCache[pubkey] = result;
      return result;
    }
  } catch (error) {
    console.error(`Erro ao buscar metadados para ${pubkey}:`, error);
  }
  return { username: 'Desconhecido', displayName: 'Desconhecido' };
}

// Função para carregar mensagens
async function loadMessages() {
  const fetcher = NostrFetcher.init();
  const loadingDiv = document.getElementById('loading');
  const messagesList = document.getElementById('messages');

  // Mostrar mensagem de carregamento
  loadingDiv.style.display = 'block';

  try {
    messagesList.innerHTML = '';

    let messageCount = 0;

    // Buscar eventos dos últimos 15 minutos
    const nMinutesAgo = (mins) => Math.floor((Date.now() - mins * 60 * 1000) / 1000);
    const postIter = fetcher.allEventsIterator(
      relayUrls,
      { kinds: [eventKind.text] },
      { since: nMinutesAgo(15) }, // Últimos 15 minutos
      { skipVerification: true }
    );

    for await (const ev of postIter) {
      // Aplicar filtro
      if (filterWord === '' || ev.content.includes(filterWord)) {
        const li = document.createElement('li');

        const npubUser = nip19.npubEncode(ev.pubkey);
        const { username, displayName } = await fetchUserMetadata(ev.pubkey, fetcher);

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble', 'received');

        const messageContent = document.createElement('div');
        messageContent.textContent = ev.content;

        // Exibir mídia
        const mediaUrlMatch = ev.content.match(/(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|mp4|webm))/gi);
        if (mediaUrlMatch) {
          mediaUrlMatch.forEach(url => {
            let mediaElement;
            if (url.match(/\.(mp4|webm)$/i)) {
              // Vídeo
              mediaElement = document.createElement('video');
              mediaElement.src = url;
              mediaElement.classList.add('media', 'video-media');
              mediaElement.controls = true;
            } else {
              // Imagem
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
        messageDetails.textContent = `Postado por: ${username} (${displayName}) | ${formatTimestamp(ev.created_at)} | ${npubUser}`;

        li.appendChild(messageBubble);
        li.appendChild(messageDetails);

        messagesList.appendChild(li);

        messageCount++;
      }
    }

    if (messageCount === 0) {
      const noMessages = document.createElement('p');
      noMessages.textContent = 'Nenhuma mensagem encontrada.';
      messagesList.appendChild(noMessages);
    }

  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    messagesList.innerHTML = '';
    const errorMsg = document.createElement('p');
    errorMsg.style.color = 'red';
    errorMsg.textContent = 'Erro ao buscar mensagens. Por favor, tente novamente mais tarde.';
    messagesList.appendChild(errorMsg);
  } finally {
    // Ocultar mensagem de carregamento
    loadingDiv.style.display = 'none';
  }

  // Iniciar o monitoramento em tempo real
  startRealTimeMonitoring();
}

// Função para iniciar a escuta em tempo real
function startRealTimeMonitoring() {
  // Encerrar a subscrição atual, se houver
  if (subs) {
    subs.unsub();
  }

  const filters = [
    {
      kinds: [eventKind.text],
      since: Math.floor(Date.now() / 1000), // Eventos a partir de agora
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

      // Exibir mídia
      const mediaUrlMatch = event.content.match(/(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|mp4|webm))/gi);
      if (mediaUrlMatch) {
        mediaUrlMatch.forEach(url => {
          let mediaElement;
          if (url.match(/\.(mp4|webm)$/i)) {
            // Vídeo
            mediaElement = document.createElement('video');
            mediaElement.src = url;
            mediaElement.classList.add('media', 'video-media');
            mediaElement.controls = true;
          } else {
            // Imagem
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
      messageDetails.textContent = `Postado por: ${username} (${displayName}) | ${formatTimestamp(event.created_at)} | ${npubUser}`;

      li.appendChild(messageBubble);
      li.appendChild(messageDetails);

      messagesList.appendChild(li);

      // Scroll para o final
      messagesList.scrollTop = messagesList.scrollHeight;
    }
  });

  subs.on('eose', () => {
    console.log('Fim dos eventos armazenados');
  });
}
