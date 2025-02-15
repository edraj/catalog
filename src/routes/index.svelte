<script lang="ts">
    import { writable, derived } from 'svelte/store';
    import { Container, Row, Col, Button, Navbar, NavbarBrand, NavbarToggler, Collapse, Nav, NavItem, NavLink } from 'sveltestrap';
    import { goto } from '@roxi/routify';
    $goto

    // Sample data
    const items = [
        { title: 'Title 1', date: '2023-01-01', description: 'Description 1' },
        { title: 'Title 2', date: '2023-01-02', description: 'Description 2' },
        { title: 'Title 3', date: '2023-01-03', description: 'Description 3' },
        { title: 'Title 4', date: '2023-01-04', description: 'Description 4' },
        { title: 'Title 5', date: '2023-01-05', description: 'Description 5' },
        { title: 'Title 6', date: '2023-01-06', description: 'Description 6' },
        { title: 'Title 7', date: '2023-01-07', description: 'Description 7' },
        { title: 'Title 8', date: '2023-01-08', description: 'Description 8' },
        { title: 'Title 9', date: '2023-01-09', description: 'Description 9' },
        { title: 'Title 10', date: '2023-01-10', description: 'Description 10' },
        { title: 'Title 11', date: '2023-01-11', description: 'Description 11' },
        { title: 'Title 12', date: '2023-01-12', description: 'Description 12' }
    ];

    const itemsPerPage = 5;
    const currentPage = writable(1);

    const paginatedItems = derived([currentPage], ([$currentPage]) => {
        const start = ($currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return items.slice(start, end);
    });

    function nextPage() {
        currentPage.update(n => Math.min(n + 1, Math.ceil(items.length / itemsPerPage)));
    }

    function prevPage() {
        currentPage.update(n => Math.max(n - 1, 1));
    }
</script>



<Container>
    <Row class="justify-content-center mt-5">
        <Col md="8">
            {#each $paginatedItems as item}
                <div class="card m-2 p-2">
                    <div class="title-date">
                        <h2>{item.title}</h2>
                        <span>{item.date}</span>
                    </div>
                    <p>{item.description}</p>
                </div>
            {/each}
        </Col>
    </Row>
    <div class="pagination">
        <Button color="primary" on:click={prevPage} disabled={$currentPage === 1}>Previous</Button>
        <span class="d-flex align-items-center mx-5">Page {$currentPage} of {Math.ceil(items.length / itemsPerPage)}</span>
        <Button color="primary" on:click={nextPage} disabled={$currentPage === Math.ceil(items.length / itemsPerPage)}>Next</Button>
    </div>
</Container>

<style>
    .title-date {
        display: flex;
        justify-content: space-between;
    }
    .pagination {
        display: flex;
        justify-content: center;
        position: fixed;
        bottom: 0;
        width: 100%;
        background-color: white;
        padding: 1rem;
    }
</style>