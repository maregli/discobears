FROM python:3.11-bookworm

RUN pip install poetry==1.8.5

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_VIRTUALENVS_CREATE=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

WORKDIR /app

COPY ./pyproject.toml ./
RUN touch README.md

RUN poetry install --without dev --no-root && rm -rf $POETRY_CACHE_DIR

COPY ./src ./src

RUN poetry install --without dev

EXPOSE 5000

CMD ["--host", "0.0.0.0", "--port", "5000", "--debug"]
ENTRYPOINT ["poetry", "run", "python", "-m", "src.app.server"]
