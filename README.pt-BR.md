# FieldFlow

Gestão de serviços em campo, por Marcos Solutions. Projeto de portfólio com interface em português e foco em agenda, execução e rastreabilidade das visitas.

## O que funciona

- Painel diário, busca, filtros e navegação por data.
- Cadastro de clientes e agendamento com técnico, categoria e prioridade.
- Bloqueio de sobreposição de horários por técnico; horários adjacentes são permitidos.
- Visões de gestor e técnico, início do serviço, checklist, relato, foto opcional e conclusão.
- Histórico das ações e cancelamento pelo gestor.
- Layout responsivo, diálogo nativo, nomes acessíveis, foco visível e navegação por teclado.

## Dois modos

**Demonstração publicada:** aplicação estática Next.js/React. Dados fictícios ficam no localStorage deste navegador. A troca de perfil serve para explorar as telas, não é autenticação. Não use dados reais. Limpar os dados do site reinicia a demonstração; fotos podem consumir a cota do navegador.

**Modo com servidor:** API Express em TypeScript com autenticação, permissões verificadas no servidor e persistência MySQL. O Dockerfile compila o frontend com `NEXT_PUBLIC_API_URL=/api` e o Express serve a aplicação e a API na mesma origem. Essa API não está hospedada junto da demonstração estática.

## Executar a demonstração

Requer Node.js 24 e npm.

```sh
npm ci
npm run dev -- --port 3000
```

Abra http://localhost:3000. Para gerar a versão estática, use `npm run build`; o resultado fica em `out/`.

## Executar com MySQL

Requer Docker e Docker Compose.

```sh
cp .env.example .env
# Edite .env e substitua TODOS os valores de exemplo por senhas fortes.
docker compose up --build
```

Abra http://localhost:3333. Na primeira inicialização são criadas contas de demonstração: `marcos@fieldflow.local` (gestor), `ana@fieldflow.local`, `lucas@fieldflow.local` e `bruno@fieldflow.local` (técnicos). Todas usam a senha inicial configurada em `SEED_PASSWORD`, com no mínimo 12 caracteres. Essa configuração é para desenvolvimento local. Não publique essas contas de demonstração em uma operação real.

O volume `fieldflow-db` preserva os dados entre reinícios. Alterar `SEED_PASSWORD` não altera senhas de contas já existentes. O projeto ainda não oferece fluxo de troca ou recuperação de senha.

## API

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/api/health` | Verificar acesso ao banco |
| POST | `/api/login` | Receber email e password; retornar token e dados autorizados |
| GET | `/api/state` | Consultar estado permitido para o usuário |
| POST | `/api/actions` | Executar client, schedule, start, cancel ou report |
| POST | `/api/logout` | Revogar sessão atual |

Rotas autenticadas exigem `Authorization: Bearer <token>`. Senhas usam scrypt com salt individual. Sessões expiram após oito horas, ficam em memória no servidor e são perdidas ao reiniciá-lo. O frontend guarda o token apenas em memória; recarregar a página exige novo login. Há limitação de tentativas de login por IP.

## Decisões e limites

- Datas da agenda são horários civis de Brasília, sem conversão pelo fuso do computador. Visitas devem começar e terminar no mesmo dia.
- Para este MVP de uma equipe, a operação é um documento JSON em uma linha do MySQL, com contas em tabela separada. A transação usa `SELECT ... FOR UPDATE` para serializar alterações e impedir agendamentos concorrentes conflitantes. Esse bloqueio global simplifica consistência, mas limita escala. Evolução prevista: tabelas relacionais de visitas/clientes, índices e bloqueios por técnico.
- Fotos JPEG/PNG de até 1 MB ficam embutidas no documento. Não há antivírus, remoção de metadados, armazenamento externo ou múltiplas fotos. Para produção, implementar processamento e armazenamento dedicado.
- Não há sincronização em tempo real, operação offline com sincronização, multiempresa, gestão de contas, reagendamento ou edição de clientes. Os dados são atualizados após cada ação; sessões simultâneas podem exibir informações antigas até nova consulta. O servidor continua validando conflitos.
- Antes de usar com clientes reais: senhas individuais e recuperação de acesso, HTTPS, sessões compartilhadas entre instâncias, backups, migrações e monitoramento. Configure CORS apenas para a origem esperada se separar frontend e API.

## Verificação

```sh
npm test
npm run typecheck
npm run build
```

Seis testes verificam permissões, conflitos, cancelamento, conclusão, fotos e API HTTP, incluindo agendamentos concorrentes e revogação de sessão. O teste da API usa repositório em memória serializado: não é um teste de integração com MySQL. Docker/MySQL não foram executados no ambiente de criação porque Docker não está disponível.

No navegador foram verificados o painel, bloqueio de conflito, visão restrita do técnico, conclusão com checklist e persistência após recarga. A responsividade está implementada em CSS, mas não houve inspeção em dispositivo móvel real.

## Organização

- `app/`: interface React e estilos.
- `lib/domain.ts`: regras de negócio compartilhadas.
- `server/app.ts`: API e autenticação.
- `server/index.ts`: banco e transações.
- `tests/`: testes de domínio e HTTP.

Exercício sugerido: substituir o documento JSON por tabelas relacionais sem perder o teste que garante apenas um agendamento para duas solicitações concorrentes.
