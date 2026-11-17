package app.neru.ialocal;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.ai.edge.litertlm.Backend;
import com.google.ai.edge.litertlm.Content;
import com.google.ai.edge.litertlm.Contents;
import com.google.ai.edge.litertlm.Conversation;
import com.google.ai.edge.litertlm.ConversationConfig;
import com.google.ai.edge.litertlm.Engine;
import com.google.ai.edge.litertlm.EngineConfig;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * IA no celular do Neru Calorias: guarda um modelo .litertlm (Gemma 4 E2B ou E4B) na pasta do app,
 * carrega com o LiteRT-LM (GPU, ou CPU se a GPU falhar) e responde texto com até 2 imagens.
 * Tudo roda numa fila própria, para não travar o app nem as outras chamadas do Capacitor.
 */
@CapacitorPlugin(name = "IALocal")
public class IALocalPlugin extends Plugin {

    private final ExecutorService fila = Executors.newSingleThreadExecutor();
    private Engine engine;
    private String backendUsado = "";

    private File arquivoModelo() {
        File dir = new File(getContext().getFilesDir(), "modelos");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, "modelo.litertlm");
    }

    private void fechar() {
        if (engine != null) {
            try {
                engine.close();
            } catch (Throwable ignorado) {
                // já estava fechado
            }
            engine = null;
            backendUsado = "";
        }
    }

    @Override
    protected void handleOnDestroy() {
        fechar();
        fila.shutdown();
    }

    @PluginMethod
    public void info(PluginCall call) {
        File f = arquivoModelo();
        JSObject r = new JSObject();
        r.put("temModelo", f.exists() && f.length() > 0);
        r.put("bytes", f.exists() ? f.length() : 0);
        r.put("carregado", engine != null);
        r.put("backend", backendUsado);
        call.resolve(r);
    }

    // ---------- trazer o modelo para o aparelho ----------

    @PluginMethod
    public void escolherModelo(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        startActivityForResult(call, i, "modeloEscolhido");
    }

    @ActivityCallback
    private void modeloEscolhido(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("Nenhum arquivo escolhido.", "CANCELADO");
            return;
        }
        final Uri uri = result.getData().getData();
        fila.execute(() -> {
            long total = -1;
            try (Cursor c = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.SIZE }, null, null, null)) {
                if (c != null && c.moveToFirst() && !c.isNull(0)) total = c.getLong(0);
            } catch (Throwable ignorado) {
                // sem tamanho: o progresso fica indeterminado
            }
            try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                long n = copiar(in, total);
                JSObject r = new JSObject();
                r.put("bytes", n);
                call.resolve(r);
            } catch (Throwable t) {
                call.reject("Não deu para copiar o modelo: " + t.getMessage());
            }
        });
    }

    @PluginMethod
    public void baixarModelo(PluginCall call) {
        final String url = call.getString("url", "");
        if (url.isEmpty()) {
            call.reject("Falta o endereço do modelo.");
            return;
        }
        fila.execute(() -> {
            HttpURLConnection con = null;
            try {
                con = (HttpURLConnection) new URL(url).openConnection();
                con.setInstanceFollowRedirects(true);
                con.setConnectTimeout(20000);
                con.setReadTimeout(60000);
                int codigo = con.getResponseCode();
                if (codigo == 401 || codigo == 403) {
                    call.reject("O site pediu login para baixar este modelo. Baixa pelo navegador e usa \"Escolher arquivo\".", "LOGIN");
                    return;
                }
                if (codigo >= 400) {
                    call.reject("O download respondeu com erro " + codigo + ".");
                    return;
                }
                try (InputStream in = new BufferedInputStream(con.getInputStream())) {
                    long n = copiar(in, con.getContentLengthLong());
                    JSObject r = new JSObject();
                    r.put("bytes", n);
                    call.resolve(r);
                }
            } catch (Throwable t) {
                call.reject("O download falhou: " + t.getMessage());
            } finally {
                if (con != null) con.disconnect();
            }
        });
    }

    // Copia para um arquivo temporário e só troca o modelo no fim, avisando o progresso a cada 1%
    private long copiar(InputStream in, long total) throws Exception {
        fechar();
        File destino = arquivoModelo();
        File tmp = new File(destino.getParentFile(), "modelo.tmp");
        long feitos = 0;
        int ultimoPct = -1;
        byte[] buf = new byte[1 << 16];
        try (OutputStream out = new FileOutputStream(tmp)) {
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                feitos += n;
                int pct = total > 0 ? (int) (feitos * 100 / total) : -1;
                if (pct != ultimoPct) {
                    ultimoPct = pct;
                    JSObject p = new JSObject();
                    p.put("feitos", feitos);
                    p.put("total", total);
                    notifyListeners("progresso", p);
                }
            }
        }
        if (feitos < 1000000) {
            tmp.delete();
            throw new Exception("arquivo pequeno demais para ser um modelo");
        }
        if (destino.exists()) destino.delete();
        if (!tmp.renameTo(destino)) throw new Exception("não deu para gravar o arquivo");
        return feitos;
    }

    @PluginMethod
    public void apagarModelo(PluginCall call) {
        fila.execute(() -> {
            fechar();
            boolean ok = !arquivoModelo().exists() || arquivoModelo().delete();
            JSObject r = new JSObject();
            r.put("apagado", ok);
            call.resolve(r);
        });
    }

    // ---------- carregar e responder ----------

    @PluginMethod
    public void carregar(PluginCall call) {
        final String preferido = call.getString("backend", "gpu");
        fila.execute(() -> {
            fechar();
            File f = arquivoModelo();
            if (!f.exists()) {
                call.reject("Nenhum modelo no aparelho.", "SEM_MODELO");
                return;
            }
            String cache = getContext().getCacheDir().getAbsolutePath();
            String[] ordem = "cpu".equals(preferido) ? new String[] { "cpu" } : new String[] { "gpu", "cpu" };
            Throwable erro = null;
            for (String b : ordem) {
                try {
                    Backend principal = "gpu".equals(b) ? new Backend.GPU() : new Backend.CPU();
                    Backend visao = "gpu".equals(b) ? new Backend.GPU() : new Backend.CPU();
                    // modelo, backend, visão, áudio (sem), máximo de tokens, máximo de imagens, pasta de cache
                    EngineConfig cfg = new EngineConfig(f.getAbsolutePath(), principal, visao, null, 4096, 2, cache);
                    Engine e = new Engine(cfg);
                    e.initialize();
                    engine = e;
                    backendUsado = b;
                    erro = null;
                    break;
                } catch (Throwable t) {
                    erro = t;
                }
            }
            if (engine == null) {
                call.reject("Não deu para carregar o modelo: " + (erro != null ? erro.getMessage() : "erro desconhecido"));
                return;
            }
            JSObject r = new JSObject();
            r.put("backend", backendUsado);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void descarregar(PluginCall call) {
        fila.execute(() -> {
            fechar();
            call.resolve();
        });
    }

    @PluginMethod
    public void gerar(PluginCall call) {
        final String sistema = call.getString("sistema", "");
        final String texto = call.getString("texto", "");
        final JSArray imagens = call.getArray("imagens");
        fila.execute(() -> {
            if (engine == null) {
                call.reject("O modelo não está carregado.", "NAO_CARREGADO");
                return;
            }
            Conversation conversa = null;
            try {
                long inicio = System.currentTimeMillis();
                ConversationConfig cc = sistema.isEmpty() ? new ConversationConfig() : new ConversationConfig(Contents.Companion.of(sistema));
                conversa = engine.createConversation(cc);
                List<Content> partes = new ArrayList<>();
                if (imagens != null) {
                    for (int i = 0; i < imagens.length(); i++) {
                        String b64 = imagens.getString(i);
                        int virgula = b64.indexOf(',');
                        if (virgula >= 0) b64 = b64.substring(virgula + 1);
                        partes.add(new Content.ImageBytes(Base64.decode(b64, Base64.DEFAULT)));
                    }
                }
                partes.add(new Content.Text(texto));
                com.google.ai.edge.litertlm.Message resposta = conversa.sendMessage(Contents.Companion.of(partes));
                JSObject r = new JSObject();
                r.put("texto", resposta.toString());
                r.put("ms", System.currentTimeMillis() - inicio);
                call.resolve(r);
            } catch (Throwable t) {
                call.reject("A IA do celular falhou: " + t.getMessage());
            } finally {
                if (conversa != null) {
                    try {
                        conversa.close();
                    } catch (Throwable ignorado) {
                        // nada a fazer
                    }
                }
            }
        });
    }
}
