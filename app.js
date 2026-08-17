alert("APP JS NUEVO CARGADO");
const zipInput = document.getElementById("zipInput");
const status = document.getElementById("status");

const stats = document.getElementById("stats");
const batchSection = document.getElementById("batchSection");
const debug = document.getElementById("debug");

const debugContent = document.getElementById("debugContent");

const followersCount = document.getElementById("followersCount");
const followingCount = document.getElementById("followingCount");
const notFollowingCount = document.getElementById("notFollowingCount");

const batchNumber = document.getElementById("batchNumber");
const totalBatches = document.getElementById("totalBatches");
const batchInfo = document.getElementById("batchInfo");

const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const userList = document.getElementById("userList");
const search = document.getElementById("search");

const selectAll = document.getElementById("selectAll");
const clearAll = document.getElementById("clearAll");

const previousBatch = document.getElementById("previousBatch");
const nextBatch = document.getElementById("nextBatch");
const resetProgress = document.getElementById("resetProgress");

const BATCH_SIZE = 100;

let notFollowingUsers = [];
let currentBatch = 0;

/*
  Guardamos aquí los usuarios que ya has
  procesado manualmente.
*/
let processedUsers = new Set();

/*
  Recuperar progreso anterior.
*/
loadProgress();


/* =========================================================
   CARGAR ZIP
========================================================= */

zipInput.addEventListener("change", async (event) => {

    const file = event.target.files[0];

    if (!file) return;

    try {

        status.textContent =
            "⏳ Analizando ZIP de Instagram...";

        stats.classList.add("hidden");
        batchSection.classList.add("hidden");
        debug.classList.add("hidden");

        const zip = await JSZip.loadAsync(file);

        const allFiles = Object.keys(zip.files);

        /* =================================================
           FOLLOWERS
        ================================================= */

        const followersFiles = allFiles
            .filter(path => {

                const name =
                    path.split("/").pop().toLowerCase();

                return /^followers(_\d+)?\.json$/i.test(name);

            })
            .sort((a, b) => {

                return getFileNumber(a) - getFileNumber(b);

            });


        /* =================================================
           FOLLOWING
        ================================================= */

        const followingFiles = allFiles
            .filter(path => {

                const name =
                    path.split("/").pop().toLowerCase();

                return /^following(_\d+)?\.json$/i.test(name);

            });


        /* =================================================
           DEBUG
        ================================================= */

        debug.classList.remove("hidden");

        debugContent.innerHTML = `
            <p>
                <strong>Archivos followers:</strong>
                ${followersFiles.length}
            </p>

            <p>
                <strong>Archivos following:</strong>
                ${followingFiles.length}
            </p>

            <details>
                <summary>Ver archivos detectados</summary>
                <pre>${escapeHtml(
                    [
                        ...followersFiles,
                        ...followingFiles
                    ].join("\n")
                )}</pre>
            </details>
        `;


        if (followersFiles.length === 0) {

            status.textContent =
                "❌ No encuentro followers_*.json";

            return;
        }


        if (followingFiles.length === 0) {

            status.textContent =
                "❌ No encuentro following.json";

            return;
        }


        /* =================================================
           EXTRAER FOLLOWERS
        ================================================= */

        const followers = new Set();

        for (const filename of followersFiles) {

            const zipFile = zip.files[filename];

            if (!zipFile || zipFile.dir) continue;

            const content =
                await zipFile.async("string");

            let data;

            try {

                data = JSON.parse(content);

            } catch {

                continue;
            }

            const users = extractFollowers(data);

            users.forEach(username => {
                followers.add(username);
            });
        }


        /* =================================================
           EXTRAER FOLLOWING
        ================================================= */

        const following = new Set();

        for (const filename of followingFiles) {

            const zipFile = zip.files[filename];

            if (!zipFile || zipFile.dir) continue;

            const content =
                await zipFile.async("string");

            let data;

            try {

                data = JSON.parse(content);

            } catch {

                continue;
            }

            const users = extractFollowing(data);

            users.forEach(username => {
                following.add(username);
            });
        }


        /* =================================================
           DEBUG
        ================================================= */

        debugContent.innerHTML += `
            <hr>

            <p>
                <strong>Followers encontrados:</strong>
                ${followers.size}
            </p>

            <p>
                <strong>Following encontrados:</strong>
                ${following.size}
            </p>
        `;


        if (followers.size === 0) {

            status.textContent =
                "❌ No hemos podido extraer los seguidores.";

            return;
        }


        if (following.size === 0) {

            status.textContent =
                "❌ No hemos podido extraer los seguidos.";

            return;
        }


        /* =================================================
           COMPARAR
        ================================================= */

        notFollowingUsers =
            [...following]
                .filter(username => !followers.has(username))
                .sort((a, b) =>
                    a.localeCompare(b)
                );


        /* =================================================
           ESTADÍSTICAS
        ================================================= */

        followersCount.textContent =
            followers.size;

        followingCount.textContent =
            following.size;

        notFollowingCount.textContent =
            notFollowingUsers.length;


        stats.classList.remove("hidden");

        /*
          Intentamos conservar el progreso anterior,
          pero solo si corresponde a estos usuarios.
        */
        processedUsers = new Set(
            [...processedUsers]
                .filter(username =>
                    notFollowingUsers.includes(username)
                )
        );

        saveProgress();


        /*
          Restauramos un lote razonable.
        */
        const maxBatch =
            getTotalBatches() - 1;

        if (currentBatch > maxBatch) {
            currentBatch = Math.max(0, maxBatch);
        }


        batchSection.classList.remove("hidden");

        renderBatch();

        status.textContent =
            `✅ Análisis completado. ${notFollowingUsers.length} cuentas no te siguen.`;

    } catch (error) {

        console.error(error);

        status.textContent =
            "❌ Error analizando el ZIP.";

        debug.classList.remove("hidden");

        debugContent.innerHTML += `
            <hr>
            <pre>${escapeHtml(
                error.stack || error.toString()
            )}</pre>
        `;
    }

});


/* =========================================================
   EXTRAER FOLLOWERS
========================================================= */

function extractFollowers(data) {

    const usernames = new Set();

    if (Array.isArray(data)) {

        for (const entry of data) {

            extractFromEntry(
                entry,
                usernames
            );
        }

        return usernames;
    }

    extractRecursively(
        data,
        usernames
    );

    return usernames;
}


/* =========================================================
   EXTRAER FOLLOWING
========================================================= */

function extractFollowing(data) {

    const usernames = new Set();

    if (
        data &&
        Array.isArray(data.relationships_following)
    ) {

        for (
            const entry
            of data.relationships_following
        ) {

            if (
                typeof entry.title === "string"
            ) {

                const username =
                    cleanUsername(entry.title);

                if (username) {
                    usernames.add(username);
                }
            }

            extractFromEntry(
                entry,
                usernames
            );
        }

        return usernames;
    }

    extractRecursively(
        data,
        usernames
    );

    return usernames;
}


/* =========================================================
   EXTRAER UNA ENTRADA
========================================================= */

function extractFromEntry(
    entry,
    usernames
) {

    if (
        !entry ||
        typeof entry !== "object"
    ) {
        return;
    }


    if (
        Array.isArray(entry.string_list_data)
    ) {

        for (
            const item
            of entry.string_list_data
        ) {

            if (
                item &&
                typeof item.value === "string"
            ) {

                const username =
                    cleanUsername(item.value);

                if (username) {
                    usernames.add(username);
                }
            }
        }
    }


    if (
        typeof entry.title === "string"
    ) {

        const username =
            cleanUsername(entry.title);

        if (username) {
            usernames.add(username);
        }
    }
}


/* =========================================================
   RECURSIVO
========================================================= */

function extractRecursively(
    data,
    usernames
) {

    if (!data) return;


    if (Array.isArray(data)) {

        data.forEach(item =>
            extractRecursively(
                item,
                usernames
            )
        );

        return;
    }


    if (typeof data === "object") {

        extractFromEntry(
            data,
            usernames
        );

        Object.values(data).forEach(value =>
            extractRecursively(
                value,
                usernames
            )
        );
    }
}


/* =========================================================
   LIMPIAR USERNAME
========================================================= */

function cleanUsername(value) {

    if (!value) return null;

    const username =
        value
            .trim()
            .replace(/^@/, "")
            .toLowerCase();


    if (
        !/^[a-zA-Z0-9._]+$/.test(username)
    ) {
        return null;
    }


    if (username.length > 40) {
        return null;
    }


    return username;
}


/* =========================================================
   NÚMERO ARCHIVO FOLLOWERS
========================================================= */

function getFileNumber(path) {

    const name =
        path.split("/").pop();

    const match =
        name.match(
            /followers_(\d+)\.json/i
        );

    if (!match) {
        return 1;
    }

    return parseInt(
        match[1],
        10
    );
}


/* =========================================================
   LOTES
========================================================= */

function getTotalBatches() {

    return Math.max(
        1,
        Math.ceil(
            notFollowingUsers.length /
            BATCH_SIZE
        )
    );
}


function getCurrentBatchUsers() {

    const start =
        currentBatch * BATCH_SIZE;

    const end =
        start + BATCH_SIZE;

    return notFollowingUsers.slice(
        start,
        end
    );
}


/* =========================================================
   RENDERIZAR LOTE
========================================================= */

function renderBatch() {

    if (
        notFollowingUsers.length === 0
    ) {
        return;
    }


    const total =
        getTotalBatches();

    const users =
        getCurrentBatchUsers();


    batchNumber.textContent =
        currentBatch + 1;

    totalBatches.textContent =
        total;


    const startNumber =
        currentBatch * BATCH_SIZE + 1;

    const endNumber =
        currentBatch * BATCH_SIZE +
        users.length;


    batchInfo.textContent =
        `Cuentas ${startNumber}–${endNumber}`;


    renderUsers(users);

    updateProgress();


    previousBatch.disabled =
        currentBatch === 0;

    nextBatch.disabled =
        currentBatch >= total - 1;


    previousBatch.textContent =
        currentBatch === 0
            ? "← Anterior"
            : `← Lote ${currentBatch}`;


    nextBatch.textContent =
        currentBatch >= total - 1
            ? "Último lote"
            : `Siguiente →`;
}


/* =========================================================
   RENDERIZAR USUARIOS
========================================================= */

function renderUsers(users) {

    const query =
        search.value
            .trim()
            .toLowerCase();


    userList.innerHTML = "";


    const filtered =
        users.filter(username =>
            username.includes(query)
        );


    if (filtered.length === 0) {

        userList.innerHTML = `
            <div class="user">
                No hay resultados.
            </div>
        `;

        return;
    }


    filtered.forEach(username => {

        const row =
            document.createElement("div");

        row.className =
            "user";


        if (
            processedUsers.has(username)
        ) {

            row.classList.add(
                "processed"
            );
        }


        const checkbox =
            document.createElement(
                "input"
            );

        checkbox.type =
            "checkbox";

        checkbox.className =
            "userCheckbox";

        checkbox.value =
            username;

        checkbox.checked =
            processedUsers.has(username);


        const name =
            document.createElement(
                "span"
            );

        name.textContent =
            "@" + username;


        /*
          Abrir directamente el perfil.
        */

        const openButton =
            document.createElement(
                "button"
            );

        openButton.type =
            "button";

        openButton.className =
            "open-instagram";

        openButton.textContent =
            "Abrir";


        openButton.addEventListener(
            "click",
            () => {

                const url =
                    `https://www.instagram.com/${encodeURIComponent(username)}/`;

                window.open(
                    url,
                    "_blank"
                );

            }
        );


        /*
          Marcar como procesado.
        */

        checkbox.addEventListener(
            "change",
            () => {

                if (
                    checkbox.checked
                ) {

                    processedUsers.add(
                        username
                    );

                } else {

                    processedUsers.delete(
                        username
                    );
                }


                saveProgress();

                updateProgress();

                updateProcessedRow(
                    row,
                    username
                );
            }
        );


        row.appendChild(
            checkbox
        );

        row.appendChild(
            name
        );

        row.appendChild(
            openButton
        );


        userList.appendChild(
            row
        );

    });
}


/* =========================================================
   ACTUALIZAR FILA PROCESADA
========================================================= */

function updateProcessedRow(
    row,
    username
) {

    if (
        processedUsers.has(username)
    ) {

        row.classList.add(
            "processed"
        );

    } else {

        row.classList.remove(
            "processed"
        );
    }
}


/* =========================================================
   PROGRESO
========================================================= */

function updateProgress() {

    const users =
        getCurrentBatchUsers();


    const processedInBatch =
        users.filter(username =>
            processedUsers.has(username)
        ).length;


    const percentage =
        users.length === 0
            ? 0
            : Math.round(
                processedInBatch /
                users.length *
                100
            );


    progressBar.style.width =
        `${percentage}%`;


    progressText.textContent =
        `${processedInBatch} / ${users.length} procesados (${percentage}%)`;


    /*
      Si se termina el lote,
      ponemos una indicación visual.
    */

    if (
        users.length > 0 &&
        processedInBatch === users.length
    ) {

        batchInfo.textContent =
            `✅ Lote ${currentBatch + 1} completado`;

    }
}


/* =========================================================
   BUSCADOR
========================================================= */

search.addEventListener(
    "input",
    () => {

        renderUsers(
            getCurrentBatchUsers()
        );

    }
);


/* =========================================================
   SELECCIONAR TODOS
========================================================= */

selectAll.addEventListener(
    "click",
    () => {

        const users =
            getCurrentBatchUsers();

        users.forEach(username =>
            processedUsers.add(username)
        );


        saveProgress();

        renderUsers(users);

        updateProgress();
    }
);


/* =========================================================
   DESELECCIONAR TODOS
========================================================= */

clearAll.addEventListener(
    "click",
    () => {

        const users =
            getCurrentBatchUsers();

        users.forEach(username =>
            processedUsers.delete(username)
        );


        saveProgress();

        renderUsers(users);

        updateProgress();
    }
);


/* =========================================================
   LOTE ANTERIOR
========================================================= */

previousBatch.addEventListener(
    "click",
    () => {

        if (
            currentBatch <= 0
        ) {
            return;
        }


        currentBatch--;

        search.value = "";

        renderBatch();

        saveProgress();
    }
);


/* =========================================================
   SIGUIENTE LOTE
========================================================= */

nextBatch.addEventListener(
    "click",
    () => {

        const total =
            getTotalBatches();


        if (
            currentBatch >= total - 1
        ) {
            return;
        }


        currentBatch++;

        search.value = "";

        renderBatch();

        saveProgress();

        
