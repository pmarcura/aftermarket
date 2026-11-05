# Bot administrativo do AFTERMARKET

## Estado e escopo

Bot exclusivo **AFTERMARKET**, administrado por chamadas à API REST oficial. O Pedro confirmou o aceite dos termos e da política para desenvolvedores, o armazenamento local do token e a autorização do bot. A interface do Discord confirmou que o bot foi autorizado e adicionado ao servidor.

- Aplicação/client ID: `1567697721555689523`.
- [Aplicação no portal do Discord](https://discord.com/developers/applications/1567697721555689523/bot).
- Descrição salva: “Assistente oficial da comunidade AFTERMARKET. Administração dos canais, convites e identidade do servidor pela equipe do jogo.”
- Ícone da aplicação: planeta, escolhido pelo usuário. O ícone do servidor ainda não foi alterado pela API.
- Evidências locais de autorização: `.runtime/community/bot-autorizado.jpg` e `.runtime/community/bot-permissoes.jpg`.

| Etapa                                 | Estado verificado                                             |
| ------------------------------------- | ------------------------------------------------------------- |
| Aplicação criada e ID registrado      | AFTERMARKET · `1567697721555689523`                           |
| Bot instalado no servidor             | Autorizado e adicionado, confirmado pela interface do Discord |
| Token salvo localmente                | Pendente                                                      |
| Consulta autenticada de estado        | Pendente                                                      |
| Ícone e convite configurados pela API | Pendente                                                      |

Servidor único permitido: `1567690605864165508`. O [utilitário local](../../scripts/discord-admin.ts) cobre estado, ícone, convite e nome, tópico ou posição de canal. Não há comandos de exclusão, alteração de permissões ou publicação/leitura de mensagens. As mensagens atuais do Pedro ficam preservadas. O fluxo de inscrição continua sendo o de [DISCORD.md](DISCORD.md).

Não há Gateway, processo residente, intents privilegiados ou dependência nova no jogo. Requisições administrativas são feitas à API HTTPS do Discord; IDs de canal precisam pertencer ao servidor permitido. As alterações têm prévia por padrão e exigem `--apply` para execução.

## Instalação no servidor

A autorização concluída usou o scope **`bot`**, sem OAuth da conta pessoal e sem Administrator, com o servidor AFTERMARKET fixado. Instalação no usuário está desativada; instalação no servidor, ativada. O link padrão de instalação está em **Nenhum** e **Bot público** está desativado. Intents de membros, presença e conteúdo de mensagens estão desligados.

Permissões autorizadas para administração do servidor; envio, fixação e alteração de permissões ficam reservados a uma evolução posterior, pois o utilitário inicial não executa essas ações:

| Permissão                               | Finalidade                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `CREATE_INSTANT_INVITE`                 | Criar o convite de entrada                                                                                              |
| `MANAGE_CHANNELS`                       | Ajustar nome, tópico e organização dos canais                                                                           |
| `MANAGE_GUILD`                          | Aplicar o ícone do servidor                                                                                             |
| `VIEW_CHANNEL` e `READ_MESSAGE_HISTORY` | Acesso necessário aos canais autorizados e seu histórico; não libera conteúdo de inscrições sem o intent correspondente |
| `SEND_MESSAGES` e `PIN_MESSAGES`        | Envio e fixação de mensagens em uma evolução posterior; não há comando de publicação na primeira versão                 |
| `MANAGE_ROLES`                          | Alterar sobrescritas de permissão de canais, quando necessário                                                          |

Bitfield calculado com inteiros grandes: **`2251800082189361`**. Inclui `PIN_MESSAGES = 1 << 51`. Não inclui `ADMINISTRATOR`, `VIEW_AUDIT_LOG` nem `MANAGE_MESSAGES`.

Parâmetros da autorização concluída, sem token:

```text
https://discord.com/oauth2/authorize?client_id=1567697721555689523&scope=bot&permissions=2251800082189361&guild_id=1567690605864165508&disable_guild_select=true
```

`MANAGE_ROLES` também permite administrar cargos abaixo do maior cargo do bot. Manter a hierarquia e o escopo sob controle; essa permissão não deve ser repassada a participantes. Permissões do servidor não anulam negações de `@everyone` nos canais. Conferir acesso específico do bot onde houver bloqueio de envio ou leitura, principalmente NOVIDADES, `#comece-aqui` e `#equipe`.

Ao alterar permissões, preservar os valores existentes. A API restringe quais flags o bot pode permitir ou negar; não conceder Administrator para contornar uma falha. Conferir a permissão efetiva e o acesso necessário à ação.

## Token local

O token **ainda não foi salvo**. O portal abriu a confirmação de segurança para redefini-lo; falta o responsável concluir a confirmação/2FA. O destino autorizado é `D:\Novidade\.runtime\discord.env`, com o token do bot, nunca o da conta pessoal:

```dotenv
DISCORD_BOT_TOKEN=COLE_O_TOKEN_DO_BOT_SOMENTE_NO_ARQUIVO_LOCAL
```

Não enviar o token no chat, em argumentos de comandos, capturas ou documentação. `.runtime/` já está ignorado pelo Git. O arquivo de segredo ainda não foi criado nem verificado. Se houver exposição do token, substituí-lo no portal e atualizar o arquivo local.

## Validação local

Utilitário conferido localmente: **20 testes aprovados**, TypeScript sem erros, formatação aprovada e `--help` executado sem token. Isso não comprova autenticação, acesso ou alterações reais no Discord; a primeira consulta autenticada continua pendente da credencial.

## Comandos

Executar a partir de `D:\Novidade`. A ajuda não precisa de token:

```powershell
node --import tsx scripts/discord-admin.ts --help
```

Os comandos abaixo carregam o segredo do arquivo local. `status` consulta bot, servidor, cargos, canais e permissões, sem conteúdo de mensagens:

```powershell
node --env-file=.runtime/discord.env --import tsx scripts/discord-admin.ts status
```

A estimativa de permissões considera `@everyone` sozinho; outros cargos e sobrescritas por membro podem mudar o resultado. A consulta não substitui o teste com participante.

Prévia e aplicação do ícone existente:

```powershell
node --env-file=.runtime/discord.env --import tsx scripts/discord-admin.ts icon apps/web/public/favicon.png
node --env-file=.runtime/discord.env --import tsx scripts/discord-admin.ts icon apps/web/public/favicon.png --apply
```

Prévia e criação do convite permanente para `#comece-aqui`. Se já houver um convite permanente compatível no canal, o comando o reutiliza:

```powershell
node --env-file=.runtime/discord.env --import tsx scripts/discord-admin.ts invite 1567691094043525171
node --env-file=.runtime/discord.env --import tsx scripts/discord-admin.ts invite 1567691094043525171 --apply
```

Exemplo de prévia para ajustar `#inscricoes`. As opções de canal usam `=`; tópico com espaços fica entre aspas:

```powershell
node --env-file=.runtime/discord.env --import tsx scripts/discord-admin.ts channel 1567692450796011702 --name=inscricoes "--topic=Registre seu interesse no teste fechado. Disponibilidade opcional; sem garantia de vaga ou prazo." --position=1
```

Só adicionar `--apply` após conferir servidor, canal e mudança. A prévia também exige token e consulta o Discord para validar o alvo; ela não funciona offline. O comando de canal não move o canal para outra categoria nem altera suas permissões.

Não reexecutar uma alteração após erro de rede sem consultar o estado atual. Permissão ausente deve ser investigada no canal ou no cargo do bot. A API pode limitar requisições; respeitar o intervalo indicado na resposta.

## Critério de conclusão

- [x] Aplicação e ID reais registrados; instalação confirmada pela interface no servidor permitido.
- [ ] Token presente apenas no arquivo local ignorado pelo Git.
- [ ] `status` autenticado retorna a identidade esperada do bot e o servidor correto.
- [ ] Prévia de cada alteração conferida antes de `--apply`.
- [ ] Ícone e convite reais conferidos depois da execução.
- [ ] Mensagens existentes e permissões não envolvidas na alteração preservadas.
- [ ] Convite e fluxo com participante validados conforme [DISCORD.md](DISCORD.md).

## Referências oficiais

- [Autorização de bot](https://docs.discord.com/developers/topics/oauth2#bot-authorization-flow).
- [Permissões e hierarquia](https://docs.discord.com/developers/topics/permissions).
- [Permissões de canais](https://docs.discord.com/developers/resources/channel#edit-channel-permissions).
- [Fixação de mensagens](https://docs.discord.com/developers/resources/message#pin-message).
- [Restrições HTTP e conteúdo de mensagens](https://docs.discord.com/developers/events/gateway#http-restrictions).
