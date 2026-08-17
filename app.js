const zipInput =
  document.getElementById("zipInput");

const status =
  document.getElementById("status");

const stats =
  document.getElementById("stats");

const manager =
  document.getElementById("manager");

const debug =
  document.getElementById("debug");

const debugContent =
  document.getElementById("debugContent");

const followersCount =
  document.getElementById("followersCount");

const followingCount =
  document.getElementById("followingCount");

const notFollowingCount =
  document.getElementById("notFollowingCount");

const batchNumber =
  document.getElementById("batchNumber");

const totalBatches =
  document.getElementById("totalBatches");

const batchInfo =
  document.getElementById("batchInfo");

const progressBar =
  document.getElementById("progressBar");

const progressText =
  document.getElementById("progressText");

const userList =
  document.getElementById("userList");

const search =
  document.getElementById("search");

const selectAll =
  document.getElementById("selectAll");

const clearAll =
  document.getElementById("clearAll");

const previousBatch =
  document.getElementById("previousBatch");

const nextBatch =
  document.getElementById("nextBatch");

const resetProgress =
  document.getElementById("resetProgress");


const BATCH_SIZE = 100;

let notFollowingUsers = [];

let processedUsers = new Set();

let currentBatch = 0;


/* =====================================================
   CARGAR PROGRESO
===================================================== */

loadProgress();


/* =====================================================
   CARGAR ZIP
===================================================== */

zipInput.addEventListener(
  "change",
  async function(event) {

    try {

      const file =
        event.target.files[0];

      if (!file) {

        return;

      }


      status.textContent =
        "⏳ Leyendo ZIP de Instagram...";


      stats.classList.add(
        "hidden"
      );

      manager.classList.add(
        "hidden"
      );

      debug.classList.add(
        "hidden"
      );


      if (
        typeof JSZip === "undefined"
      ) {

        throw new Error(
          "JSZip no se ha cargado."
        );

      }


      const zip =
        await JSZip.loadAsync(
          file
        );


      const files =
        Object.keys(
          zip.files
        );


      console.log(
        "Archivos:",
        files
      );


      /* =================================================
         BUSCAR FOLLOWERS
      ================================================= */

      const followersFiles =
        files
          .filter(function(path) {

            const name =
              path
                .split("/")
                .pop()
                .toLowerCase();


            return /^followers(_\d+)?\.json$/i
              .test(name);

          })
          .sort();


      /* =================================================
         BUSCAR FOLLOWING
      ================================================= */

      const followingFiles =
        files
          .filter(function(path) {

            const name =
              path
                .split("/")
                .pop()
                .toLowerCase();


            return /^following(_\d+)?\.json$/i
              .test(name);

          });


      /* =================================================
         DIAGNÓSTICO
      ================================================= */

      debug.classList.remove(
        "hidden"
      );


      debugContent.innerHTML = `

        <p>
          <strong>Followers JSON:</strong>
          ${followersFiles.length}
        </p>

        <p>
          <strong>Following JSON:</strong>
          ${followingFiles.length}
        </p>

        <details>

          <summary>
            Archivos encontrados
          </summary>

          <pre>${escapeHtml(
            [
              ...followersFiles,
              ...followingFiles
            ].join("\n")
          )}</pre>

        </details>

      `;


      if (
        followersFiles.length === 0
      ) {

        throw new Error(
          "No se encontró followers_*.json"
        );

      }


      if (
        followingFiles.length === 0
      ) {

        throw new Error(
          "No se encontró following.json"
        );

      }


      /* =================================================
         FOLLOWERS
      ================================================= */

      const followers =
        new Set();


      for (
        const path of followersFiles
      ) {

        const zipFile =
          zip.files[path];


        if (
          !zipFile ||
          zipFile.dir
        ) {

          continue;

        }


        const content =
          await zipFile.async(
            "string"
          );


        let data;


        try {

          data =
            JSON.parse(
              content
            );

        } catch {

          continue;

        }


        const users =
          extractFollowers(
            data
          );


        users.forEach(
          function(username) {

            followers.add(
              username
            );

          }
        );

      }


      /* =================================================
         FOLLOWING
      ================================================= */

      const following =
        new Set();


      for (
        const path of followingFiles
      ) {

        const zipFile =
          zip.files[path];


        if (
          !zipFile ||
          zipFile.dir
        ) {

          continue;

        }


        const content =
          await zipFile.async(
            "string"
          );


        let data;


        try {

          data =
            JSON.parse(
              content
            );

        } catch {

          continue;

        }


        const users =
          extractFollowing(
            data
          );


        users.forEach(
          function(username) {

            following.add(
              username
            );

          }
        );

      }


      /* =================================================
         MOSTRAR DEBUG
      ================================================= */

      debugContent.innerHTML += `

        <hr>

        <p>
          <strong>Seguidores encontrados:</strong>
          ${followers.size}
        </p>

        <p>
          <strong>Siguiendo encontrados:</strong>
          ${following.size}
        </p>

      `;


      /* =================================================
         VALIDACIÓN
      ================================================= */

      if (
        followers.size === 0
      ) {

        throw new Error(
          "Se encontró followers_1.json pero no se pudieron extraer usuarios."
        );

      }


      if (
        following.size === 0
      ) {

        throw new Error(
          "Se encontró following.json pero no se pudieron extraer usuarios."
        );

      }


      /* =================================================
         COMPARAR
      ================================================= */

      notFollowingUsers =
        Array
          .from(following)
          .filter(function(username) {

            return !followers.has(
              username
            );

          })
          .sort(function(a, b) {

            return a.localeCompare(
              b
            );

          });


      /* =================================================
         ELIMINAR PROGRESO INVÁLIDO
      ================================================= */

      processedUsers =
        new Set(
          Array
            .from(processedUsers)
            .filter(function(username) {

              return notFollowingUsers.includes(
                username
              );

            })
        );


      saveProgress();


      /* =================================================
         ESTADÍSTICAS
      ================================================= */

      followersCount.textContent =
        followers.size;

      followingCount.textContent =
        following.size;

      notFollowingCount.textContent =
        notFollowingUsers.length;


      stats.classList.remove(
        "hidden"
      );


      manager.classList.remove(
        "hidden"
      );


      const maxBatch =
        Math.max(
          0,
          getTotalBatches() - 1
        );


      if (
        currentBatch >
        maxBatch
      ) {

        currentBatch =
          maxBatch;

      }


      renderBatch();


      status.textContent =
        "✅ Análisis completado.";


    } catch (error) {

      console.error(
        error
      );


      status.textContent =
        "❌ " + error.message;


      debug.classList.remove(
        "hidden"
      );


      debugContent.innerHTML += `

        <hr>

        <pre>${escapeHtml(
          error.stack ||
          error.toString()
        )}</pre>

      `;

    }

  }
);


/* =====================================================
   FOLLOWERS
===================================================== */

function extractFollowers(
  data
) {

  const users =
    new Set();


  if (
    Array.isArray(
      data
    )
  ) {

    data.forEach(
      function(entry) {

        extractEntry(
          entry,
          users
        );

      }
    );


    return users;

  }


  recursiveExtract(
    data,
    users
  );


  return users;
}


/* =====================================================
   FOLLOWING
===================================================== */

function extractFollowing(
  data
) {

  const users =
    new Set();


  if (
    data &&
    Array.isArray(
      data.relationships_following
    )
  ) {

    data
      .relationships_following
      .forEach(
        function(entry) {

          extractEntry(
            entry,
            users
          );

        }
      );


    return users;

  }


  recursiveExtract(
    data,
    users
  );


  return users;
}


/* =====================================================
   EXTRAER ENTRADA
===================================================== */

function extractEntry(
  entry,
  users
) {

  if (
    !entry ||
    typeof entry !== "object"
  ) {

    return;

  }


  /* title */

  if (
    typeof entry.title === "string"
  ) {

    const username =
      cleanUsername(
        entry.title
      );


    if (username) {

      users.add(
        username
      );

    }

  }


  /* string_list_data */

  if (
    Array.isArray(
      entry.string_list_data
    )
  ) {

    entry
      .string_list_data
      .forEach(
        function(item) {

          if (
            item &&
            typeof item.value === "string"
          ) {

            const username =
              cleanUsername(
                item.value
              );


            if (username) {

              users.add(
                username
              );

            }

          }

        }
      );

  }

}


/* =====================================================
   RECURSIVO
===================================================== */

function recursiveExtract(
  data,
  users
) {

  if (!data) {

    return;

  }


  if (
    Array.isArray(
      data
    )
  ) {

    data.forEach(
      function(item) {

        recursiveExtract(
          item,
          users
        );

      }
    );


    return;

  }


  if (
    typeof data === "object"
  ) {

    extractEntry(
      data,
      users
    );


    Object
      .values(data)
      .forEach(
        function(value) {

          recursiveExtract(
            value,
            users
          );

        }
      );

  }

}


/* =====================================================
   LIMPIAR USERNAME
===================================================== */

function cleanUsername(
  value
) {

  if (!value) {

    return null;

  }


  const username =
    value
      .trim()
      .replace(
        /^@/,
        ""
      )
      .toLowerCase();


  if (
    username.length === 0
  ) {

    return null;

  }


  if (
    username.length > 40
  ) {

    return null;

  }


  if (
    !/^[a-zA-Z0-9._]+$/.test(
      username
    )
  ) {

    return null;

  }


  return username;
}


/* =====================================================
   LOTES
===================================================== */

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
    currentBatch *
    BATCH_SIZE;


  return notFollowingUsers.slice(
    start,
    start + BATCH_SIZE
  );

}


/* =====================================================
   RENDER LOTE
===================================================== */

function renderBatch() {

  const users =
    getCurrentBatchUsers();


  const total =
    getTotalBatches();


  batchNumber.textContent =
    currentBatch + 1;


  totalBatches.textContent =
    total;


  const first =
    currentBatch *
    BATCH_SIZE +
    1;


  const last =
    currentBatch *
    BATCH_SIZE +
    users.length;


  batchInfo.textContent =
    `Cuentas ${first}–${last}`;


  renderUsers(
    users
  );


  updateProgress();


  previousBatch.disabled =
    currentBatch === 0;


  nextBatch.disabled =
    currentBatch >= total - 1;

}


/* =====================================================
   RENDER USUARIOS
===================================================== */

function renderUsers(
  users
) {

  const query =
    search.value
      .trim()
      .toLowerCase();


  userList.innerHTML =
    "";


  const filtered =
    users.filter(
      function(username) {

        return username.includes(
          query
        );

      }
    );


  if (
    filtered.length === 0
  ) {

    userList.innerHTML = `
      <div class="user">
        No hay resultados.
      </div>
    `;


    return;

  }


  filtered.forEach(
    function(username) {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "user";


      if (
        processedUsers.has(
          username
        )
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


      checkbox.checked =
        processedUsers.has(
          username
        );


      checkbox.addEventListener(
        "change",
        function() {

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


          if (
            checkbox.checked
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
      );


      const name =
        document.createElement(
          "span"
        );


      name.className =
        "user-name";


      name.textContent =
        "@" + username;


      const openButton =
        document.createElement(
          "button"
        );


      openButton.className =
        "open-button";


      openButton.textContent =
        "Abrir";


      openButton.addEventListener(
        "click",
        function() {

          window.open(
            "https://www.instagram.com/" +
            encodeURIComponent(
              username
            ) +
            "/",
            "_blank"
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

    }
  );

}


/* =====================================================
   PROGRESO
===================================================== */

function updateProgress() {

  const users =
    getCurrentBatchUsers();


  const processed =
    users.filter(
      function(username) {

        return processedUsers.has(
          username
        );

      }
    ).length;


  const percent =
    users.length === 0
      ? 0
      : Math.round(
          processed /
          users.length *
          100
        );


  progressBar.style.width =
    percent + "%";


  progressText.textContent =
    `${processed} / ${users.length} procesados (${percent}%)`;

}


/* =====================================================
   BUSCADOR
===================================================== */

search.addEventListener(
  "input",
  function() {

    renderUsers(
      getCurrentBatchUsers()
    );

  }
);


/* =====================================================
   SELECCIONAR LOTE
===================================================== */

selectAll.addEventListener(
  "click",
  function() {

    getCurrentBatchUsers()
      .forEach(
        function(username) {

          processedUsers.add(
            username
          );

        }
      );


    saveProgress();


    renderBatch();

  }
);


/* =====================================================
   DESELECCIONAR LOTE
===================================================== */

clearAll.addEventListener(
  "click",
  function() {

    getCurrentBatchUsers()
      .forEach(
        function(username) {

          processedUsers.delete(
            username
          );

        }
      );


    saveProgress();


    renderBatch();

  }
);


/* =====================================================
   ANTERIOR
===================================================== */

previousBatch.addEventListener(
  "click",
  function() {

    if (
      currentBatch === 0
    ) {

      return;

    }


    currentBatch--;

    search.value =
      "";


    saveProgress();

    renderBatch();


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }
);


/* =====================================================
   SIGUIENTE
===================================================== */

nextBatch.addEventListener(
  "click",
  function() {

    const total =
      getTotalBatches();


    if (
      currentBatch >=
      total - 1
    ) {

      return;

    }


    currentBatch++;

    search.value =
      "";


    saveProgress();

    renderBatch();


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }
);


/* =====================================================
   REINICIAR
===================================================== */

resetProgress.addEventListener(
  "click",
  function() {

    const confirmReset =
      window.confirm(
        "¿Quieres borrar todo el progreso?"
      );


    if (!confirmReset) {

      return;

    }


    processedUsers =
      new Set();


    currentBatch =
      0;


    saveProgress();


    renderBatch();

  }
);


/* =====================================================
   GUARDAR
===================================================== */

function saveProgress() {

  const data = {

    processedUsers:
      Array.from(
        processedUsers
      ),

    currentBatch:
      currentBatch

  };


  localStorage.setItem(
    "instagramUnfollowersProgress",
    JSON.stringify(
      data
    )
  );

}


/* =====================================================
   RECUPERAR
===================================================== */

function loadProgress() {

  try {

    const saved =
      localStorage.getItem(
        "instagramUnfollowersProgress"
      );


    if (!saved) {

      return;

    }


    const data =
      JSON.parse(
        saved
      );


    if (
      Array.isArray(
        data.processedUsers
      )
    ) {

      processedUsers =
        new Set(
          data.processedUs
